import { describe, expect, it } from "vitest";

import { createFixtureLessonEarningSource } from "../../../../packages/domain/payouts/fixtures";
import type { LessonEarningEvent, PayoutActor } from "../../../../packages/domain/payouts/models";
import {
  approveEarningEntries,
  createMonthlyPayoutBatch,
  exportPayoutBatchCsv,
  markExternalPayoutComplete,
  recordLessonEarnings,
} from "../../../../packages/domain/payouts/services";
import { InMemoryPayoutDatabase } from "./support/in-memory-payout-database";

const finance: PayoutActor = {
  userId: "finance-user",
  roles: ["finance"],
};

function fixture(overrides: Partial<LessonEarningEvent> = {}): LessonEarningEvent {
  return {
    lessonId: "lesson-completed",
    tutorProfileId: "tutor-1",
    outcome: "completed",
    isTrial: false,
    earnedAt: new Date("2026-07-15T18:00:00.000Z"),
    scheduledCompensationAmountMinor: 10_000,
    compensationCurrency: "USD",
    earningPercentage: 100,
    companyPriceAmountMinor: 18_000,
    companyPriceCurrency: "USD",
    ...overrides,
  };
}

const july = { periodStart: "2026-07-01", periodEnd: "2026-07-31" };

describe("payout earning-entry contract", () => {
  it("creates completed/chargeable snapshots, skips trials by default, and never reprices an existing lesson", async () => {
    const database = new InMemoryPayoutDatabase();
    const source = createFixtureLessonEarningSource([
      fixture(),
      fixture({
        lessonId: "lesson-chargeable",
        outcome: "chargeable",
        scheduledCompensationAmountMinor: 5_000,
        earningPercentage: 50,
      }),
      fixture({
        lessonId: "lesson-trial",
        isTrial: true,
        scheduledCompensationAmountMinor: 2_000,
      }),
    ]);

    const first = await recordLessonEarnings(database, source, july);
    expect(first.created.map((entry) => entry.amountMinor)).toEqual([10_000, 2_500]);
    expect(first.skippedTrialLessonIds).toEqual(["lesson-trial"]);

    const repricedSource = createFixtureLessonEarningSource([
      fixture({ scheduledCompensationAmountMinor: 99_999 }),
    ]);
    const second = await recordLessonEarnings(database, repricedSource, july);
    expect(second.skippedExistingLessonIds).toEqual(["lesson-completed"]);
    expect(await database.findEarningByLessonId("lesson-completed")).toMatchObject({
      amountMinor: 10_000,
      currency: "USD",
    });

    const changedPolicy = await recordLessonEarnings(database, source, july, {
      payTrialLessons: true,
    });
    expect(changedPolicy.created).toHaveLength(1);
    expect(changedPolicy.created[0]).toMatchObject({
      lessonId: "lesson-trial",
      amountMinor: 2_000,
    });
  });

  it("reconciles every AMD payout item to the batch and records the exact FX rate/date/source", async () => {
    const database = new InMemoryPayoutDatabase();
    database.registerTutor("tutor-user", "tutor-1", "Ani Grigoryan");
    const ingestion = await recordLessonEarnings(
      database,
      createFixtureLessonEarningSource([
        fixture(),
        fixture({
          lessonId: "lesson-amd",
          scheduledCompensationAmountMinor: 250_000,
          compensationCurrency: "AMD",
        }),
      ]),
      july,
    );
    await approveEarningEntries(
      database,
      finance,
      ingestion.created.map((entry) => entry.id),
    );

    const batch = await createMonthlyPayoutBatch(database, finance, {
      ...july,
      fx: {
        baseCurrency: "USD",
        quoteCurrency: "AMD",
        rate: "405.50",
        source: "Central Bank of Armenia",
        conversionDate: "2026-07-31",
      },
    });

    expect(batch.fx).toEqual({
      baseCurrency: "USD",
      quoteCurrency: "AMD",
      rate: "405.50",
      source: "Central Bank of Armenia",
      conversionDate: "2026-07-31",
    });
    expect(batch.totalAmountMinor).toBe(4_305_000);
    expect(batch.items.map((item) => item.tutorEarningEntryId).sort()).toEqual(
      ingestion.created.map((entry) => entry.id).sort(),
    );
    expect(batch.items.reduce((total, item) => total + item.amountMinor, 0)).toBe(
      batch.totalAmountMinor,
    );
    expect(batch.reconciliation).toMatchObject({
      itemTotalAmountMinor: 4_305_000,
      differenceAmountMinor: 0,
      reconciled: true,
    });
  });

  it("requires and preserves completion evidence on every payout item and finance export row", async () => {
    const database = new InMemoryPayoutDatabase();
    const ingestion = await recordLessonEarnings(
      database,
      createFixtureLessonEarningSource([fixture()]),
      july,
    );
    await approveEarningEntries(
      database,
      finance,
      ingestion.created.map((entry) => entry.id),
    );
    const batch = await createMonthlyPayoutBatch(database, finance, {
      ...july,
      fx: {
        baseCurrency: "USD",
        quoteCurrency: "AMD",
        rate: "400",
        source: "CBA",
        conversionDate: "2026-07-31",
      },
    });

    await expect(
      markExternalPayoutComplete(database, finance, batch.id, {
        evidenceRef: "",
        paidAt: new Date("2026-08-02T10:00:00.000Z"),
      }),
    ).rejects.toMatchObject({ code: "EVIDENCE_REQUIRED", status: 400 });

    const completed = await markExternalPayoutComplete(database, finance, batch.id, {
      evidenceRef: "drive://finance/payouts/2026-07-transfer.pdf",
      paidAt: new Date("2026-08-02T10:00:00.000Z"),
    });
    expect(completed.status).toBe("completed");
    expect(completed.items).toEqual([
      expect.objectContaining({
        status: "paid",
        evidenceRef: "drive://finance/payouts/2026-07-transfer.pdf",
      }),
    ]);

    const exported = await exportPayoutBatchCsv(database, finance, batch.id);
    expect(exported.filename).toContain("payouts-2026-07");
    expect(exported.csv).not.toContain("Central Bank");
    expect(exported.csv).toContain("drive://finance/payouts/2026-07-transfer.pdf");
    expect(exported.csv).toContain('"400","CBA","2026-07-31"');
  });
});
