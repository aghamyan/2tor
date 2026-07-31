import { describe, expect, it } from "vitest";

import { createFixtureLessonEarningSource } from "../../../../packages/domain/payouts/fixtures";
import {
  getFinanceEarningLedger,
  getTutorEarningsSummary,
  recordLessonEarnings,
} from "../../../../packages/domain/payouts/services";
import { InMemoryPayoutDatabase } from "./support/in-memory-payout-database";

const july = { periodStart: "2026-07-01", periodEnd: "2026-07-31" };

describe("payout authorization projections", () => {
  it("never exposes company price or margin fields to a tutor", async () => {
    const database = new InMemoryPayoutDatabase();
    database.registerTutor("tutor-user", "tutor-1", "Ani Grigoryan");
    database.setCompanyPrice("lesson-1", 18_000, "USD");
    await recordLessonEarnings(
      database,
      createFixtureLessonEarningSource([
        {
          lessonId: "lesson-1",
          tutorProfileId: "tutor-1",
          outcome: "completed",
          isTrial: false,
          earnedAt: new Date("2026-07-10T18:00:00.000Z"),
          scheduledCompensationAmountMinor: 10_000,
          compensationCurrency: "USD",
          earningPercentage: 100,
          companyPriceAmountMinor: 18_000,
          companyPriceCurrency: "USD",
        },
      ]),
      july,
    );

    const summary = await getTutorEarningsSummary(
      database,
      { userId: "tutor-user", roles: ["tutor"] },
      july,
    );
    const serialized = JSON.stringify(summary);
    expect(summary.completedLessonCount).toBe(1);
    expect(summary.expectedTotals).toEqual([{ currency: "USD", amountMinor: 10_000 }]);
    expect(serialized).not.toMatch(/companyPrice|companyMargin|margin/i);

    await expect(
      getFinanceEarningLedger(database, { userId: "tutor-user", roles: ["tutor"] }, july),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
  });

  it("keeps price and margin available only in the finance ledger", async () => {
    const database = new InMemoryPayoutDatabase();
    database.registerTutor("tutor-user", "tutor-1", "Ani Grigoryan");
    database.setCompanyPrice("lesson-1", 18_000, "USD");
    await recordLessonEarnings(
      database,
      createFixtureLessonEarningSource([
        {
          lessonId: "lesson-1",
          tutorProfileId: "tutor-1",
          outcome: "completed",
          isTrial: false,
          earnedAt: new Date("2026-07-10T18:00:00.000Z"),
          scheduledCompensationAmountMinor: 10_000,
          compensationCurrency: "USD",
          earningPercentage: 100,
        },
      ]),
      july,
    );
    const ledger = await getFinanceEarningLedger(
      database,
      { userId: "finance-user", roles: ["finance"] },
      july,
    );
    expect(ledger[0]).toMatchObject({
      companyPriceAmountMinor: 18_000,
      companyMarginAmountMinor: 8_000,
    });
  });
});
