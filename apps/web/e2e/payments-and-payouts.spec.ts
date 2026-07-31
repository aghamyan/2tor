import { expect, expectJson, test } from "./fixtures/actors";
import { databaseRows } from "./helpers/database";
import { signedStripeEvent } from "./helpers/stripe";

interface Envelope<T> {
  data: T;
  requestId: string;
}

test.describe.serial("payments and tutor payouts", () => {
  test("billing authorization is scoped and a signed webhook is idempotent", async ({ actors }) => {
    const forbiddenResponse = await actors.tutor.post("/api/payments/intents", {
      headers: { "idempotency-key": "e2e-tutor-cannot-authorize" },
      data: { invoiceId: "invoice_e2e_authorization" },
    });
    const forbidden = await expectJson<{ error: { code: string } }>(forbiddenResponse, 403);
    expect(forbidden.error.code).toBe("FORBIDDEN");

    const eventId = "evt_e2e_authorization_once";
    const { payload, signature } = signedStripeEvent({
      id: eventId,
      object: "event",
      api_version: "2026-06-30.basil",
      created: Math.floor(Date.now() / 1_000),
      livemode: false,
      pending_webhooks: 1,
      request: { id: null, idempotency_key: null },
      type: "payment_intent.amount_capturable_updated",
      data: {
        object: {
          id: "pi_e2e_authorization",
          object: "payment_intent",
        },
      },
    });

    const deliver = () =>
      actors.admin.post("/api/payments/webhooks/stripe", {
        data: payload,
        headers: {
          "content-type": "application/json",
          "stripe-signature": signature,
        },
      });

    const first = await expectJson<Envelope<{ applied: boolean; ignored: boolean }>>(
      await deliver(),
      200,
    );
    expect(first.data).toEqual({ applied: true, ignored: false });

    const replay = await expectJson<Envelope<{ applied: boolean; ignored: boolean }>>(
      await deliver(),
      200,
    );
    expect(replay.data).toEqual({ applied: false, ignored: false });

    const [charge] = databaseRows<{ status: string }>(
      "SELECT status FROM lesson_charges WHERE id = 'lcharge_e2e_authorization'",
    );
    expect(charge?.status).toBe("authorized");
    const [claimCount] = databaseRows<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM audit_events ` +
        `WHERE action = 'payments.stripe_webhook.received' AND resource_id = '${eventId}'`,
    );
    expect(claimCount?.count).toBe(1);
  });

  test("finance creates, reconciles, exports, and completes a tutor payout batch", async ({
    actors,
  }) => {
    const forbiddenResponse = await actors.tutor.post("/api/payouts/batches", {
      data: {
        periodStart: "2026-01-01",
        periodEnd: "2026-01-31",
        fx: {
          baseCurrency: "USD",
          quoteCurrency: "AMD",
          rate: "400.00",
          source: "E2E fixed test rate",
          conversionDate: "2026-01-31",
        },
      },
    });
    await expectJson<{ error: { code: string } }>(forbiddenResponse, 403);

    const batchResponse = await actors.admin.post("/api/payouts/batches", {
      data: {
        periodStart: "2026-01-01",
        periodEnd: "2026-01-31",
        fx: {
          baseCurrency: "USD",
          quoteCurrency: "AMD",
          rate: "400.00",
          source: "E2E fixed test rate",
          conversionDate: "2026-01-31",
        },
      },
    });
    const batch = await expectJson<
      Envelope<{
        id: string;
        status: string;
        currency: string;
        totalAmountMinor: number;
        items: Array<{ amountMinor: number; status: string }>;
        reconciliation: { reconciled: boolean; differenceAmountMinor: number };
      }>
    >(batchResponse, 201);
    expect(batch.data).toMatchObject({
      status: "draft",
      currency: "AMD",
      totalAmountMinor: 468000,
    });
    expect(batch.data.reconciliation).toEqual({
      batchTotalAmountMinor: 468000,
      itemTotalAmountMinor: 468000,
      differenceAmountMinor: 0,
      reconciled: true,
    });

    const exportResponse = await actors.admin.get(`/api/payouts/batches/${batch.data.id}/export`);
    expect(exportResponse.status()).toBe(200);
    expect(exportResponse.headers()["content-type"]).toContain("text/csv");
    const csv = await exportResponse.text();
    expect(csv).toContain('"tutor_name"');
    expect(csv).toContain('"Davit Grigoryan"');
    expect(csv).toContain('"468000"');

    const completeResponse = await actors.admin.post(
      `/api/payouts/batches/${batch.data.id}/complete`,
      {
        data: {
          evidenceRef: "s3://e2e-private/payouts/january-bank-confirmation.pdf",
          paidAt: "2026-02-02T12:00:00.000Z",
        },
      },
    );
    const completed = await expectJson<
      Envelope<{
        status: string;
        items: Array<{ status: string; evidenceRef: string }>;
        reconciliation: { reconciled: boolean };
      }>
    >(completeResponse, 200);
    expect(completed.data.status).toBe("completed");
    expect(completed.data.reconciliation.reconciled).toBe(true);
    expect(completed.data.items).toEqual([
      expect.objectContaining({
        status: "paid",
        evidenceRef: "s3://e2e-private/payouts/january-bank-confirmation.pdf",
      }),
    ]);
  });
});
