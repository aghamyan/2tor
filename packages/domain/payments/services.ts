import { ulid } from "ulid";

// packages/domain cannot declare @app/auth without an out-of-scope package.json edit.
import { authorize } from "../../auth/src/index";
import type { ChargeableLessonEvent } from "../scheduling/chargeable-events";
import { PaymentError } from "./errors";
import { paymentId, requireIdempotencyKey } from "./idempotency";
import type {
  DiscountRecord,
  FinancialReport,
  InvoiceRecord,
  LessonPriceType,
  PaymentActor,
  PaymentCurrency,
  PaymentDatabase,
  PaymentGateway,
  PaymentNotifier,
  PaymentPage,
  PaymentTransactionRecord,
  PriceRuleRecord,
  RefundRecord,
  StripePaymentWebhookEvent,
} from "./models";
import {
  createDiscountSchema,
  createPriceSchema,
  createRefundSchema,
  financialReportSchema,
  invoiceListSchema,
  prepareInvoicePaymentSchema,
  transactionListSchema,
  type CreateDiscountInput,
  type CreatePriceInput,
  type CreateRefundInput,
} from "./schemas";

const DAY_MS = 24 * 60 * 60 * 1_000;

function requireActor(actor: PaymentActor | null | undefined): asserts actor is PaymentActor {
  if (!actor) {
    throw new PaymentError("UNAUTHENTICATED", "A signed-in actor is required.", 401);
  }
}

function isAdministrator(actor: PaymentActor): boolean {
  return actor.roles.includes("administrator") || actor.roles.includes("super_administrator");
}

function authorizeFinanceView(actor: PaymentActor): void {
  const decision = authorize(actor, "finance.view_transactions", {
    kind: "financial_record",
  });
  if (!decision.allowed) throw new PaymentError("FORBIDDEN", decision.reason, 403);
}

function assertSafeMoney(amountMinor: number, currency: PaymentCurrency): void {
  if (!Number.isSafeInteger(amountMinor) || amountMinor < 0) {
    throw new PaymentError(
      "INVALID_INPUT",
      `A ${currency} amount must be a non-negative safe integer in minor units.`,
    );
  }
}

/** Integer half-up multiplication; no floating-point money arithmetic. */
function multiplyRatio(amountMinor: number, numerator: number, denominator: number): number {
  assertSafeMoney(amountMinor, "USD");
  if (!Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator) || denominator <= 0) {
    throw new PaymentError("INVALID_INPUT", "The charge ratio is invalid.");
  }
  const result =
    (BigInt(amountMinor) * BigInt(numerator) + BigInt(Math.floor(denominator / 2))) /
    BigInt(denominator);
  const value = Number(result);
  if (!Number.isSafeInteger(value)) {
    throw new PaymentError("INVALID_INPUT", "The calculated money amount is too large.");
  }
  return value;
}

function lessonPriceType(event: ChargeableLessonEvent): LessonPriceType {
  if (event.lessonKind === "group") return "group";
  if (event.lessonKind === "trial") return "trial";
  return "standard";
}

function discountAmount(
  discount: DiscountRecord | null,
  subtotalMinor: number,
  currency: PaymentCurrency,
  at: Date,
): number {
  if (
    !discount ||
    !discount.isActive ||
    (discount.startsAt && discount.startsAt > at) ||
    (discount.endsAt && discount.endsAt <= at)
  ) {
    return 0;
  }
  if (discount.percentOffBasisPoints !== null) {
    return Math.min(
      subtotalMinor,
      multiplyRatio(subtotalMinor, discount.percentOffBasisPoints, 10_000),
    );
  }
  if (discount.amountOffMinor !== null && discount.currency === currency) {
    return Math.min(subtotalMinor, discount.amountOffMinor);
  }
  return 0;
}

export interface ChargeableEventInvoiceOptions {
  idempotencyKey: string;
  discountCode?: string | null;
  now?: Date;
}

/**
 * Consumes D5's event contract. The price lookup and every copied money field are committed in
 * one transaction. lessonId's DB uniqueness plus deterministic IDs make overlapping worker scans
 * safe.
 */
export async function invoiceChargeableEvent(
  database: PaymentDatabase,
  event: ChargeableLessonEvent,
  options: ChargeableEventInvoiceOptions,
): Promise<InvoiceRecord> {
  const key = requireIdempotencyKey(options.idempotencyKey);
  if (
    !Number.isInteger(event.chargePercentage) ||
    event.chargePercentage <= 0 ||
    event.chargePercentage > 100
  ) {
    throw new PaymentError("INVALID_INPUT", "Charge percentage must be an integer from 1 to 100.");
  }
  return database.transaction(async (transaction) => {
    const existingCharge = await transaction.getLessonChargeByLessonId(event.lessonId);
    if (existingCharge) {
      const existingInvoice = await transaction.findInvoiceByLessonChargeId(existingCharge.id);
      if (existingInvoice) return existingInvoice;
    }

    const facts = await transaction.getBillingFactsForAssignment(
      event.tutorStudentAssignmentId,
      event.lessonId,
    );
    if (!facts) {
      throw new PaymentError(
        "BILLING_PARENT_NOT_FOUND",
        "No primary billing parent is linked to this lesson.",
        409,
      );
    }
    const price = await transaction.findPrice(
      facts.subjectId,
      lessonPriceType(event),
      event.scheduledStartAt,
    );
    if (!price) {
      throw new PaymentError("PRICE_NOT_FOUND", "No effective price exists for this lesson.", 409);
    }
    assertSafeMoney(price.amountMinor, price.currency);
    const subtotalMinor = multiplyRatio(price.amountMinor, event.chargePercentage, 100);
    const discount = options.discountCode
      ? await transaction.getDiscountByCode(options.discountCode.trim().toUpperCase())
      : null;
    const discountMinor = discountAmount(discount, subtotalMinor, price.currency, event.canceledAt);
    const now = options.now ?? new Date();
    const chargeId = paymentId("lesson-charge", `lesson:${event.lessonId}`);
    const invoiceId = paymentId("invoice", key);
    const charge = {
      id: chargeId,
      lessonId: event.lessonId,
      parentProfileId: facts.parentProfileId,
      priceId: price.id,
      amountMinor: subtotalMinor,
      currency: price.currency,
      status: "pending" as const,
      capturedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    const invoice: InvoiceRecord = {
      id: invoiceId,
      parentProfileId: facts.parentProfileId,
      status: "open",
      currency: price.currency,
      subtotalMinor,
      discountMinor,
      totalMinor: subtotalMinor - discountMinor,
      issuedAt: now,
      dueAt: new Date(now.getTime() + DAY_MS),
      paidAt: null,
      createdAt: now,
      updatedAt: now,
      items: [
        {
          id: paymentId("invoice-item", key),
          invoiceId,
          lessonChargeId: chargeId,
          description: `Lesson charge · ${event.reasonCode}`,
          quantity: 1,
          unitAmountMinor: price.amountMinor,
          amountMinor: subtotalMinor,
          currency: price.currency,
          createdAt: now,
        },
      ],
    };
    await transaction.saveLessonCharge(charge);
    await transaction.saveInvoice(invoice);
    await transaction.appendAudit({
      id: paymentId("invoice-audit", key),
      actorUserId: null,
      action: "payments.chargeable_event.invoiced",
      resourceType: "invoices",
      resourceId: invoice.id,
      reason: event.reasonCode,
      newValue: {
        lessonId: event.lessonId,
        cancellationId: event.cancellationId,
        priceId: price.id,
        historicalUnitAmountMinor: price.amountMinor,
        chargePercentage: event.chargePercentage,
        chargedAmountMinor: subtotalMinor,
        discountMinor,
        currency: price.currency,
      },
      createdAt: now,
    });
    return invoice;
  });
}

async function parentScopeForRead(
  database: PaymentDatabase,
  actor: PaymentActor,
): Promise<string | null> {
  const financeDecision = authorize(actor, "finance.view_transactions", {
    kind: "financial_record",
  });
  if (financeDecision.allowed) return null;
  if (!actor.roles.includes("parent")) {
    throw new PaymentError("FORBIDDEN", financeDecision.reason, 403);
  }
  const parentProfileId = await database.findParentProfileIdByUserId(actor.userId);
  if (!parentProfileId) {
    throw new PaymentError("FORBIDDEN", "A billing parent profile is required.", 403);
  }
  return parentProfileId;
}

export async function listTransactionsForActor(
  database: PaymentDatabase,
  actor: PaymentActor | null | undefined,
  input: { cursor?: string | null; limit?: number } = {},
): Promise<PaymentPage<PaymentTransactionRecord>> {
  requireActor(actor);
  const values = transactionListSchema.parse(input);
  const parentProfileId = await parentScopeForRead(database, actor);
  const rows = await database.listPaymentTransactions(
    parentProfileId,
    values.cursor,
    values.limit + 1,
  );
  const hasNext = rows.length > values.limit;
  const items = hasNext ? rows.slice(0, values.limit) : rows;
  return { items, nextCursor: hasNext ? (items.at(-1)?.id ?? null) : null };
}

export async function listInvoicesForActor(
  database: PaymentDatabase,
  actor: PaymentActor | null | undefined,
  input: { cursor?: string | null; limit?: number } = {},
): Promise<PaymentPage<InvoiceRecord>> {
  requireActor(actor);
  const values = invoiceListSchema.parse(input);
  const parentProfileId = await parentScopeForRead(database, actor);
  const rows = await database.listInvoices(parentProfileId, values.cursor, values.limit + 1);
  const hasNext = rows.length > values.limit;
  const items = hasNext ? rows.slice(0, values.limit) : rows;
  return { items, nextCursor: hasNext ? (items.at(-1)?.id ?? null) : null };
}

async function requireInvoicePaymentActor(
  database: PaymentDatabase,
  actor: PaymentActor,
  invoice: InvoiceRecord,
): Promise<void> {
  if (isAdministrator(actor)) return;
  if (!actor.roles.includes("parent")) {
    throw new PaymentError("FORBIDDEN", "Only the billing parent can authorize a payment.", 403);
  }
  const parentProfileId = await database.findParentProfileIdByUserId(actor.userId);
  if (parentProfileId !== invoice.parentProfileId) {
    throw new PaymentError("FORBIDDEN", "This invoice belongs to another billing account.", 403);
  }
}

export async function prepareInvoicePayment(
  database: PaymentDatabase,
  gateway: PaymentGateway,
  actor: PaymentActor | null | undefined,
  input: { invoiceId: string },
  idempotencyKey: string,
): Promise<{ transaction: PaymentTransactionRecord; clientSecret: string }> {
  requireActor(actor);
  const values = prepareInvoicePaymentSchema.parse(input);
  const key = requireIdempotencyKey(idempotencyKey);
  const invoice = await database.getInvoice(values.invoiceId);
  if (!invoice) throw new PaymentError("INVOICE_NOT_FOUND", "Invoice was not found.", 404);
  await requireInvoicePaymentActor(database, actor, invoice);
  if (invoice.status === "paid" || invoice.status === "void" || invoice.totalMinor <= 0) {
    throw new PaymentError("PAYMENT_NOT_READY", "This invoice is not payable.", 409);
  }

  let customer = await database.getPaymentCustomer(invoice.parentProfileId);
  if (!customer) {
    const stripeCustomer = await gateway.createCustomer({
      parentProfileId: invoice.parentProfileId,
      idempotencyKey: `customer:${invoice.parentProfileId}`,
    });
    const now = new Date();
    await database.savePaymentCustomer({
      id: paymentId("payment-customer", `parent:${invoice.parentProfileId}`),
      parentProfileId: invoice.parentProfileId,
      stripeCustomerId: stripeCustomer.id,
      createdAt: now,
      updatedAt: now,
    });
    customer = await database.getPaymentCustomer(invoice.parentProfileId);
  }
  if (!customer) {
    throw new PaymentError("PAYMENT_NOT_READY", "The Stripe customer could not be prepared.", 502);
  }

  const transactionId = paymentId("payment-transaction", key);
  let transaction = await database.getPaymentTransaction(transactionId);
  if (!transaction) {
    const now = new Date();
    transaction = {
      id: transactionId,
      lessonChargeId: invoice.items.at(0)?.lessonChargeId ?? null,
      invoiceId: invoice.id,
      parentProfileId: invoice.parentProfileId,
      stripePaymentIntentId: null,
      type: "charge",
      amountMinor: invoice.totalMinor,
      currency: invoice.currency,
      status: "pending",
      processedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    await database.savePaymentTransaction(transaction);
  } else if (transaction.invoiceId !== invoice.id) {
    throw new PaymentError(
      "INVALID_INPUT",
      "This idempotency key was already used for a different invoice.",
      409,
    );
  }

  const intent = await gateway.createPaymentIntent({
    amountMinor: transaction.amountMinor,
    currency: transaction.currency,
    stripeCustomerId: customer.stripeCustomerId,
    invoiceId: invoice.id,
    transactionId: transaction.id,
    idempotencyKey: key,
    captureMethod: "manual",
  });
  const now = new Date();
  await database.updatePaymentTransaction(transaction.id, {
    stripePaymentIntentId: intent.id,
    updatedAt: now,
  });
  return {
    transaction: { ...transaction, stripePaymentIntentId: intent.id, updatedAt: now },
    clientSecret: intent.clientSecret,
  };
}

export async function requestRefund(
  database: PaymentDatabase,
  gateway: PaymentGateway,
  actor: PaymentActor | null | undefined,
  input: CreateRefundInput,
  idempotencyKey: string,
): Promise<RefundRecord> {
  requireActor(actor);
  const values = createRefundSchema.parse(input);
  const key = requireIdempotencyKey(idempotencyKey);
  const decision = authorize(actor, "finance.refund", {
    kind: "refund",
    amountMinor: values.amountMinor,
  });
  if (!decision.allowed) throw new PaymentError("FORBIDDEN", decision.reason, 403);

  const refundId = paymentId("refund", key);
  const prepared = await database.transaction(async (tx) => {
    const transaction = await tx.getPaymentTransactionForUpdate(values.paymentTransactionId);
    if (!transaction) {
      throw new PaymentError("TRANSACTION_NOT_FOUND", "Payment transaction was not found.", 404);
    }
    if (transaction.status !== "succeeded" || !transaction.stripePaymentIntentId) {
      throw new PaymentError(
        "PAYMENT_NOT_READY",
        "Only a succeeded Stripe charge can be refunded.",
        409,
      );
    }
    let refund = await tx.getRefund(refundId);
    if (!refund) {
      const priorRefunds = await tx.listRefundsForTransaction(transaction.id);
      const reservedMinor = priorRefunds
        .filter((item) => item.status !== "failed")
        .reduce((sum, item) => sum + item.amountMinor, 0);
      if (values.amountMinor > transaction.amountMinor - reservedMinor) {
        throw new PaymentError(
          "REFUND_EXCEEDS_AVAILABLE",
          "The refund exceeds the transaction's remaining refundable amount.",
          409,
        );
      }
      const now = new Date();
      const record: RefundRecord = {
        id: refundId,
        paymentTransactionId: transaction.id,
        amountMinor: values.amountMinor,
        currency: transaction.currency,
        reason: values.reason,
        status: "pending",
        requestedByUserId: actor.userId,
        approvedByUserId: actor.userId,
        processedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      await tx.saveRefund(record);
      await tx.appendAudit({
        id: paymentId("refund-audit", key),
        actorUserId: actor.userId,
        action: "payments.refund.requested",
        resourceType: "refunds",
        resourceId: record.id,
        reason: record.reason,
        previousValue: {
          transactionStatus: transaction.status,
          refundableMinor: transaction.amountMinor - reservedMinor,
        },
        newValue: {
          amountMinor: record.amountMinor,
          currency: record.currency,
          status: record.status,
        },
        createdAt: now,
      });
      refund = record;
    } else if (
      refund.paymentTransactionId !== transaction.id ||
      refund.amountMinor !== values.amountMinor
    ) {
      throw new PaymentError(
        "INVALID_INPUT",
        "This idempotency key was already used for a different refund.",
        409,
      );
    }
    return { refund, stripePaymentIntentId: transaction.stripePaymentIntentId };
  });

  await gateway.createRefund({
    stripePaymentIntentId: prepared.stripePaymentIntentId,
    amountMinor: prepared.refund.amountMinor,
    refundId: prepared.refund.id,
    idempotencyKey: key,
  });
  // Stripe's signed refund webhook is authoritative for completion and notification.
  const status = "processing" as const;
  const now = new Date();
  await database.updateRefund(prepared.refund.id, {
    status,
    processedAt: null,
    updatedAt: now,
  });
  return { ...prepared.refund, status, processedAt: null, updatedAt: now };
}

export async function createDiscount(
  database: PaymentDatabase,
  actor: PaymentActor | null | undefined,
  input: CreateDiscountInput,
  idempotencyKey: string,
): Promise<DiscountRecord> {
  requireActor(actor);
  if (!isAdministrator(actor)) {
    throw new PaymentError("FORBIDDEN", "Only administrators can control discounts.", 403);
  }
  const values = createDiscountSchema.parse(input);
  const key = requireIdempotencyKey(idempotencyKey);
  const now = new Date();
  const record: DiscountRecord = {
    id: paymentId("discount", key),
    code: values.code,
    type: values.type,
    percentOffBasisPoints: values.percentOffBasisPoints,
    amountOffMinor: values.amountOffMinor,
    currency: values.currency,
    startsAt: values.startsAt ? new Date(values.startsAt) : null,
    endsAt: values.endsAt ? new Date(values.endsAt) : null,
    createdByUserId: actor.userId,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };
  await database.transaction(async (tx) => {
    await tx.saveDiscount(record);
    await tx.appendAudit({
      id: paymentId("discount-audit", key),
      actorUserId: actor.userId,
      action: "payments.discount.created",
      resourceType: "discounts",
      resourceId: record.id,
      reason: record.type,
      newValue: {
        code: record.code,
        percentOffBasisPoints: record.percentOffBasisPoints,
        amountOffMinor: record.amountOffMinor,
        currency: record.currency,
      },
      createdAt: now,
    });
  });
  return record;
}

export async function createPriceRule(
  database: PaymentDatabase,
  actor: PaymentActor | null | undefined,
  input: CreatePriceInput,
  idempotencyKey: string,
): Promise<PriceRuleRecord> {
  requireActor(actor);
  if (!isAdministrator(actor)) {
    throw new PaymentError("FORBIDDEN", "Only administrators can control lesson prices.", 403);
  }
  const values = createPriceSchema.parse(input);
  const key = requireIdempotencyKey(idempotencyKey);
  const createdAt = new Date();
  const price: PriceRuleRecord = {
    id: paymentId("price", key),
    key: values.key,
    subjectId: values.subjectId,
    lessonType: values.lessonType,
    amountMinor: values.amountMinor,
    currency: values.currency,
    effectiveFrom: new Date(values.effectiveFrom),
    effectiveTo: values.effectiveTo ? new Date(values.effectiveTo) : null,
    createdByUserId: actor.userId,
    createdAt,
  };
  await database.transaction(async (tx) => {
    await tx.savePrice(price);
    await tx.appendAudit({
      id: paymentId("price-audit", key),
      actorUserId: actor.userId,
      action: "payments.price.created",
      resourceType: "prices",
      resourceId: price.id,
      reason: price.key,
      newValue: {
        subjectId: price.subjectId,
        lessonType: price.lessonType,
        amountMinor: price.amountMinor,
        currency: price.currency,
        effectiveFrom: price.effectiveFrom.toISOString(),
        effectiveTo: price.effectiveTo?.toISOString() ?? null,
      },
      createdAt,
    });
  });
  return price;
}

export async function setDiscountActive(
  database: PaymentDatabase,
  actor: PaymentActor | null | undefined,
  discountId: string,
  active: boolean,
  idempotencyKey: string,
): Promise<void> {
  requireActor(actor);
  if (!isAdministrator(actor)) {
    throw new PaymentError("FORBIDDEN", "Only administrators can control discounts.", 403);
  }
  const key = requireIdempotencyKey(idempotencyKey);
  const now = new Date();
  await database.transaction(async (tx) => {
    const claimed = await tx.claimIdempotency({
      id: paymentId("discount-state-claim", key),
      actorUserId: actor.userId,
      action: "payments.discount.state_changed",
      resourceType: "discounts",
      resourceId: discountId,
      reason: active ? "activated" : "deactivated",
      newValue: { isActive: active },
      createdAt: now,
    });
    if (claimed) await tx.setDiscountActive(discountId, active, now);
  });
}

export async function getFinancialReportForActor(
  database: PaymentDatabase,
  actor: PaymentActor | null | undefined,
  input: { from: string; to: string; currency: PaymentCurrency },
): Promise<FinancialReport> {
  requireActor(actor);
  authorizeFinanceView(actor);
  const values = financialReportSchema.parse(input);
  return database.getFinancialReport(new Date(values.from), new Date(values.to), values.currency);
}

export interface WebhookResult {
  applied: boolean;
  ignored: boolean;
}

function refundStatus(
  event: Extract<
    StripePaymentWebhookEvent,
    { type: "refund.created" | "refund.updated" | "refund.failed" }
  >,
): "processing" | "completed" | "failed" {
  if (event.type === "refund.failed" || event.status === "failed" || event.status === "canceled") {
    return "failed";
  }
  return event.status === "succeeded" ? "completed" : "processing";
}

export async function handleStripeWebhook(
  database: PaymentDatabase,
  notifier: PaymentNotifier,
  event: StripePaymentWebhookEvent,
): Promise<WebhookResult> {
  return database.transaction(async (tx) => {
    const claimed = await tx.claimIdempotency({
      id: paymentId("stripe-webhook", event.id),
      actorUserId: null,
      action: "payments.stripe_webhook.received",
      resourceType: "stripe_events",
      resourceId: event.id,
      reason: event.type === "ignored" ? event.sourceType : event.type,
      newValue: { createdAt: event.createdAt.toISOString() },
      createdAt: new Date(),
    });
    if (!claimed) return { applied: false, ignored: event.type === "ignored" };
    if (event.type === "ignored") return { applied: true, ignored: true };

    if ("appRefundId" in event) {
      if (!event.appRefundId) return { applied: true, ignored: true };
      const refund = await tx.getRefund(event.appRefundId);
      if (!refund) return { applied: true, ignored: true };
      const status = refundStatus(event);
      const now = new Date();
      await tx.updateRefund(refund.id, {
        status,
        processedAt: status === "completed" ? now : null,
        updatedAt: now,
      });
      if (status === "completed" && refund.status !== "completed") {
        const transaction = await tx.getPaymentTransaction(refund.paymentTransactionId);
        if (transaction) {
          const parentUserId = await tx.findParentUserIdByProfileId(transaction.parentProfileId);
          if (parentUserId) {
            await notifier.notify({
              userId: parentUserId,
              type: "payment_refund",
              amountMinor: refund.amountMinor,
              currency: refund.currency,
              relatedEntity: { type: "refund", id: refund.id },
            });
          }
          const refunded = (await tx.listRefundsForTransaction(transaction.id))
            .filter((item) => item.id === refund.id || item.status === "completed")
            .reduce((sum, item) => sum + item.amountMinor, 0);
          if (transaction.lessonChargeId && refunded >= transaction.amountMinor) {
            await tx.updateLessonCharge(transaction.lessonChargeId, {
              status: "refunded",
              updatedAt: now,
            });
          }
        }
      }
      return { applied: true, ignored: false };
    }

    if (!("paymentIntentId" in event)) return { applied: true, ignored: true };
    const transaction = await tx.getPaymentTransactionByStripeIntent(event.paymentIntentId);
    if (!transaction) return { applied: true, ignored: true };
    const invoice = transaction.invoiceId ? await tx.getInvoice(transaction.invoiceId) : null;
    const now = new Date();
    const chargeId = transaction.lessonChargeId;

    if (event.type === "payment_intent.amount_capturable_updated") {
      if (chargeId) await tx.updateLessonCharge(chargeId, { status: "authorized", updatedAt: now });
      return { applied: true, ignored: false };
    }

    if (event.type === "payment_intent.succeeded") {
      await tx.updatePaymentTransaction(transaction.id, {
        status: "succeeded",
        processedAt: event.createdAt,
        updatedAt: now,
      });
      if (chargeId) {
        await tx.updateLessonCharge(chargeId, {
          status: "captured",
          capturedAt: event.createdAt,
          updatedAt: now,
        });
      }
      if (invoice) {
        await tx.updateInvoice(invoice.id, {
          status: "paid",
          paidAt: event.createdAt,
          updatedAt: now,
        });
      }
      if (transaction.status !== "succeeded") {
        const parentUserId = await tx.findParentUserIdByProfileId(transaction.parentProfileId);
        if (parentUserId) {
          await notifier.notify({
            userId: parentUserId,
            type: "payment_receipt",
            amountMinor: transaction.amountMinor,
            currency: transaction.currency,
            relatedEntity: { type: "invoice", id: invoice?.id ?? transaction.id },
          });
        }
      }
      return { applied: true, ignored: false };
    }

    const status = event.type === "payment_intent.canceled" ? "canceled" : "failed";
    await tx.updatePaymentTransaction(transaction.id, {
      status,
      processedAt: event.createdAt,
      updatedAt: now,
    });
    if (chargeId) await tx.updateLessonCharge(chargeId, { status: "failed", updatedAt: now });
    if (event.type === "payment_intent.payment_failed" && transaction.status !== "failed") {
      const parentUserId = await tx.findParentUserIdByProfileId(transaction.parentProfileId);
      if (parentUserId) {
        await notifier.notify({
          userId: parentUserId,
          type: "payment_failure",
          amountMinor: transaction.amountMinor,
          currency: transaction.currency,
          relatedEntity: { type: "invoice", id: invoice?.id ?? transaction.id },
        });
      }
    }
    return { applied: true, ignored: false };
  });
}

/**
 * Captures manual authorizations. Stripe's own idempotency key protects the external call; the
 * succeeded webhook remains the sole source that marks local money captured.
 */
export async function reconcileAuthorizedPayments(
  database: PaymentDatabase,
  gateway: PaymentGateway,
  limit = 100,
): Promise<{ attempted: number; failed: number }> {
  const transactions = await database.listAuthorizedTransactions(Math.min(Math.max(limit, 1), 500));
  let failed = 0;
  for (const transaction of transactions) {
    if (!transaction.stripePaymentIntentId) continue;
    try {
      await gateway.capturePaymentIntent(
        transaction.stripePaymentIntentId,
        `capture:${transaction.id}`,
      );
    } catch {
      failed += 1;
    }
  }
  return { attempted: transactions.length, failed };
}

/** Used by tests and worker diagnostics; all generated write IDs remain ULID-shaped. */
export function newPaymentOperationKey(): string {
  return ulid();
}
