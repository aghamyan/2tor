import { expect, expectJson, test } from "./fixtures/actors";

interface Envelope<T> {
  data: T;
  requestId: string;
}

test.describe("tutor payouts", () => {
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
