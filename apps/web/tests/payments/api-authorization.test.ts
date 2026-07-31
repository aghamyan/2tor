import { describe, expect, it } from "vitest";

import { PaymentError } from "../../../../packages/domain/payments/errors";
import {
  getFinancialReportForActor,
  listInvoicesForActor,
} from "../../../../packages/domain/payments/services";
import { InMemoryPaymentDatabase } from "./support/in-memory-payment-database";

describe("payments API authorization policy", () => {
  it("denies cross-billing-account reads and non-finance reports", async () => {
    const database = new InMemoryPaymentDatabase();
    database.parentProfilesByUser.set("parent-a", "profile-a");
    database.parentProfilesByUser.set("parent-b", "profile-b");
    const now = new Date();
    database.invoices.set("invoice-b", {
      id: "invoice-b",
      parentProfileId: "profile-b",
      status: "open",
      currency: "USD",
      subtotalMinor: 1_800,
      discountMinor: 0,
      totalMinor: 1_800,
      issuedAt: now,
      dueAt: now,
      paidAt: null,
      createdAt: now,
      updatedAt: now,
      items: [],
    });

    const parentA = await listInvoicesForActor(
      database,
      { userId: "parent-a", roles: ["parent"] },
      {},
    );
    expect(parentA.items).toEqual([]);
    await expect(
      getFinancialReportForActor(
        database,
        { userId: "parent-a", roles: ["parent"] },
        {
          from: "2026-07-01T00:00:00.000Z",
          to: "2026-08-01T00:00:00.000Z",
          currency: "USD",
        },
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" } satisfies Partial<PaymentError>);
  });

  it("allows finance to view billing records without adding academic data", async () => {
    const database = new InMemoryPaymentDatabase();
    const page = await listInvoicesForActor(
      database,
      { userId: "finance-user", roles: ["finance"] },
      {},
    );
    expect(page.items).toEqual([]);
    await expect(
      getFinancialReportForActor(
        database,
        { userId: "finance-user", roles: ["finance"] },
        {
          from: "2026-07-01T00:00:00.000Z",
          to: "2026-08-01T00:00:00.000Z",
          currency: "USD",
        },
      ),
    ).resolves.toMatchObject({ currency: "USD" });
  });
});
