import { authorize } from "@app/auth";
import { describe, expect, it } from "vitest";

import type {
  PaymentGateway,
  PaymentNotification,
  PaymentNotifier,
} from "../../../../packages/domain/payments/models";
import {
  handleStripeWebhook,
  invoiceChargeableEvent,
  prepareInvoicePayment,
  requestRefund,
} from "../../../../packages/domain/payments/services";
import type { ChargeableLessonEvent } from "../../../../packages/domain/scheduling/chargeable-events";
import { InMemoryPaymentDatabase } from "./support/in-memory-payment-database";

class FakeGateway implements PaymentGateway {
  readonly paymentInputs: Parameters<PaymentGateway["createPaymentIntent"]>[0][] = [];
  readonly refundInputs: Parameters<PaymentGateway["createRefund"]>[0][] = [];

  async createCustomer() {
    return { id: "cus_test_reference" };
  }
  async createPaymentIntent(input: Parameters<PaymentGateway["createPaymentIntent"]>[0]) {
    this.paymentInputs.push(input);
    return {
      id: "pi_test_reference",
      clientSecret: "pi_test_secret_reference",
      status: "requires_payment_method",
    };
  }
  async capturePaymentIntent(stripePaymentIntentId: string) {
    return { id: stripePaymentIntentId, status: "processing" };
  }
  async createRefund(input: Parameters<PaymentGateway["createRefund"]>[0]) {
    this.refundInputs.push(input);
    return { id: "re_test_reference", status: "pending" };
  }
}

class FakeNotifier implements PaymentNotifier {
  readonly sent: PaymentNotification[] = [];
  async notify(input: PaymentNotification) {
    this.sent.push(input);
  }
}

const event: ChargeableLessonEvent = {
  lessonId: "lesson-1",
  cancellationId: "cancel-1",
  tutorStudentAssignmentId: "assignment-1",
  lessonKind: "individual",
  category: "parent_request",
  chargePercentage: 50,
  reasonCode: "late_cancellation_under_8h",
  scheduledStartAt: new Date("2026-07-20T12:00:00.000Z"),
  canceledAt: new Date("2026-07-20T08:00:00.000Z"),
  canceledByUserId: "parent-user",
};

function setup() {
  const database = new InMemoryPaymentDatabase();
  database.parentProfilesByUser.set("parent-user", "parent-1");
  database.parentUsersByProfile.set("parent-1", "parent-user");
  database.billingFacts.set("assignment-1:lesson-1", {
    parentProfileId: "parent-1",
    parentUserId: "parent-user",
    subjectId: "subject-1",
  });
  database.prices.set("price-1", {
    id: "price-1",
    subjectId: "subject-1",
    lessonType: "standard",
    amountMinor: 1_801,
    currency: "USD",
    effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
    effectiveTo: null,
  });
  return database;
}

describe("payments", () => {
  it("copies the historical lesson price and applies D5's cancellation percentage with integer rounding", async () => {
    const database = setup();
    const invoice = await invoiceChargeableEvent(database, event, {
      idempotencyKey: "d5-cancel-1",
      now: new Date("2026-07-20T08:01:00.000Z"),
    });
    const charge = [...database.charges.values()][0];
    expect(charge).toMatchObject({
      priceId: "price-1",
      amountMinor: 901,
      currency: "USD",
    });
    expect(invoice).toMatchObject({ subtotalMinor: 901, totalMinor: 901 });
    expect(invoice.items[0]).toMatchObject({ unitAmountMinor: 1_801, amountMinor: 901 });

    const originalPrice = database.prices.get("price-1");
    if (!originalPrice) throw new Error("Expected test price.");
    database.prices.set("price-1", {
      ...originalPrice,
      amountMinor: 9_999,
    });
    const replay = await invoiceChargeableEvent(database, event, {
      idempotencyKey: "d5-cancel-1",
    });
    expect(replay.totalMinor).toBe(901);
    expect(database.charges.size).toBe(1);
  });

  it("does not double-apply a replayed Stripe webhook or duplicate its receipt", async () => {
    const database = setup();
    const gateway = new FakeGateway();
    const notifier = new FakeNotifier();
    const invoice = await invoiceChargeableEvent(database, event, {
      idempotencyKey: "d5-cancel-1",
    });
    const prepared = await prepareInvoicePayment(
      database,
      gateway,
      { userId: "parent-user", roles: ["parent"] },
      { invoiceId: invoice.id },
      "parent-payment-1",
    );
    const stripeEvent = {
      id: "evt_payment_succeeded_1",
      type: "payment_intent.succeeded" as const,
      createdAt: new Date("2026-07-20T09:00:00.000Z"),
      paymentIntentId: "pi_test_reference",
    };

    await expect(handleStripeWebhook(database, notifier, stripeEvent)).resolves.toEqual({
      applied: true,
      ignored: false,
    });
    await expect(handleStripeWebhook(database, notifier, stripeEvent)).resolves.toEqual({
      applied: false,
      ignored: false,
    });
    expect(database.transactions.get(prepared.transaction.id)?.status).toBe("succeeded");
    expect(database.invoices.get(invoice.id)?.status).toBe("paid");
    expect(notifier.sent).toHaveLength(1);
    expect(
      [...database.audits.values()].filter(
        (audit) => audit.action === "payments.stripe_webhook.received",
      ),
    ).toHaveLength(1);
  });

  it("records an append-only audit row when finance requests a refund", async () => {
    const database = setup();
    const gateway = new FakeGateway();
    const notifier = new FakeNotifier();
    const now = new Date();
    database.transactions.set("transaction-1", {
      id: "transaction-1",
      lessonChargeId: null,
      invoiceId: null,
      parentProfileId: "parent-1",
      stripePaymentIntentId: "pi_paid_reference",
      type: "charge",
      amountMinor: 1_800,
      currency: "USD",
      status: "succeeded",
      processedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    const refund = await requestRefund(
      database,
      gateway,
      { userId: "finance-user", roles: ["finance"] },
      {
        paymentTransactionId: "transaction-1",
        amountMinor: 500,
        reason: "Service credit approved under policy.",
      },
      "refund-operation-1",
    );
    expect(refund.status).toBe("processing");
    expect(
      [...database.audits.values()].find((audit) => audit.action === "payments.refund.requested"),
    ).toMatchObject({
      actorUserId: "finance-user",
      resourceId: refund.id,
      newValue: { amountMinor: 500, currency: "USD", status: "pending" },
    });
    await handleStripeWebhook(database, notifier, {
      id: "evt_refund_completed_1",
      type: "refund.updated",
      createdAt: new Date(),
      refundId: "re_test_reference",
      appRefundId: refund.id,
      status: "succeeded",
    });
    expect(database.refunds.get(refund.id)?.status).toBe("completed");
    expect(notifier.sent).toEqual([
      {
        userId: "parent-user",
        type: "payment_refund",
        amountMinor: 500,
        currency: "USD",
        relatedEntity: { type: "refund", id: refund.id },
      },
    ]);
  });

  it("never supplies or persists PAN data and keeps finance out of academic messages", async () => {
    const database = setup();
    const gateway = new FakeGateway();
    const invoice = await invoiceChargeableEvent(database, event, {
      idempotencyKey: "d5-cancel-1",
    });
    await prepareInvoicePayment(
      database,
      gateway,
      { userId: "parent-user", roles: ["parent"] },
      { invoiceId: invoice.id },
      "parent-payment-1",
    );
    const persisted = JSON.stringify({
      customers: [...database.customers.values()],
      transactions: [...database.transactions.values()],
      gatewayInputs: gateway.paymentInputs,
    });
    expect(persisted).not.toMatch(/4242424242424242|cardNumber|pan/i);

    expect(
      authorize({ userId: "finance-user", roles: ["finance"] }, "message.read", {
        kind: "message",
        isAcademic: true,
        isMember: true,
      }),
    ).toEqual({ allowed: false, reason: "finance_cannot_read_academic_messages" });
  });
});
