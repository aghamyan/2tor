import { createDb } from "@app/db";

import { defineJob } from "../../job";
import { isObject, objectSchema } from "../notifications/_schema";
import { createDrizzlePayoutDatabase } from "../../../../../packages/domain/payouts/drizzle-database";
import { PayoutError } from "../../../../../packages/domain/payouts/errors";
import { createFixtureLessonEarningSource } from "../../../../../packages/domain/payouts/fixtures";
import type {
  LessonEarningEvent,
  PayoutActor,
  PayoutCurrency,
} from "../../../../../packages/domain/payouts/models";
import { payoutPolicyFromEnvironment } from "../../../../../packages/domain/payouts/policy";
import { lessonEarningEventSchema } from "../../../../../packages/domain/payouts/schemas";
import {
  approveEarningEntries,
  createMonthlyPayoutBatch,
  recordLessonEarnings,
} from "../../../../../packages/domain/payouts/services";

type Payload = {
  period?: string;
  createdByUserId?: string;
  fxBaseCurrency?: PayoutCurrency;
  fxRate?: string;
  fxSource?: string;
  conversionDate?: string;
  lessonFixtures?: unknown[];
};

const schema = objectSchema<Payload>(
  (value): value is Payload =>
    isObject(value) &&
    (value.period === undefined ||
      (typeof value.period === "string" && /^\d{4}-\d{2}$/.test(value.period))) &&
    (value.createdByUserId === undefined || typeof value.createdByUserId === "string") &&
    (value.fxBaseCurrency === undefined ||
      value.fxBaseCurrency === "USD" ||
      value.fxBaseCurrency === "AMD") &&
    (value.fxRate === undefined || typeof value.fxRate === "string") &&
    (value.fxSource === undefined || typeof value.fxSource === "string") &&
    (value.conversionDate === undefined || typeof value.conversionDate === "string") &&
    (value.lessonFixtures === undefined || Array.isArray(value.lessonFixtures)),
);

function previousUtcMonth(now = new Date()): string {
  const previous = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return previous.toISOString().slice(0, 7);
}

function monthBounds(period: string): { periodStart: string; periodEnd: string } {
  const [year, month] = period.split("-").map(Number);
  if (!year || !month || month < 1 || month > 12) {
    throw new Error("Payout period must be YYYY-MM.");
  }
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0));
  return {
    periodStart: start.toISOString().slice(0, 10),
    periodEnd: end.toISOString().slice(0, 10),
  };
}

function configuredFixtures(data: Payload): LessonEarningEvent[] {
  let raw: unknown[] = data.lessonFixtures ?? [];
  if (raw.length === 0 && process.env.PAYOUT_LESSON_FIXTURES_JSON) {
    const parsed: unknown = JSON.parse(process.env.PAYOUT_LESSON_FIXTURES_JSON);
    if (!Array.isArray(parsed)) {
      throw new Error("PAYOUT_LESSON_FIXTURES_JSON must contain an array.");
    }
    raw = parsed;
  }
  return raw.map((fixture) => lessonEarningEventSchema.parse(fixture));
}

/**
 * Runs on the first of each month for the prior UTC month. Until D5 ships its production lesson
 * source, `lessonFixtures` (or PAYOUT_LESSON_FIXTURES_JSON) feeds the exact same contract.
 */
export default defineJob({
  name: "payouts.generate-monthly-report",
  queue: "payouts",
  schema,
  async handler(data, context) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) throw new Error("DATABASE_URL is required for monthly payouts.");
    const createdByUserId = data.createdByUserId ?? process.env.PAYOUT_SYSTEM_FINANCE_USER_ID;
    if (!createdByUserId) {
      throw new Error("PAYOUT_SYSTEM_FINANCE_USER_ID is required for monthly payouts.");
    }
    const fxRate = data.fxRate ?? process.env.PAYOUT_FX_RATE;
    const fxSource = data.fxSource ?? process.env.PAYOUT_FX_SOURCE;
    if (!fxRate || !fxSource) {
      throw new Error("PAYOUT_FX_RATE and PAYOUT_FX_SOURCE are required for monthly payouts.");
    }

    const period = data.period ?? previousUtcMonth();
    const bounds = monthBounds(period);
    const actor: PayoutActor = {
      userId: createdByUserId,
      roles: ["finance"],
    };
    const database = createDrizzlePayoutDatabase(createDb(databaseUrl));
    const source = createFixtureLessonEarningSource(configuredFixtures(data));
    const ingestion = await recordLessonEarnings(
      database,
      source,
      bounds,
      payoutPolicyFromEnvironment(),
    );
    if (ingestion.created.length > 0) {
      await approveEarningEntries(
        database,
        actor,
        ingestion.created.map((entry) => entry.id),
      );
    }

    try {
      const batch = await createMonthlyPayoutBatch(database, actor, {
        ...bounds,
        fx: {
          baseCurrency:
            data.fxBaseCurrency ??
            (process.env.PAYOUT_FX_BASE_CURRENCY as PayoutCurrency | undefined) ??
            "USD",
          quoteCurrency: "AMD",
          rate: fxRate,
          source: fxSource,
          conversionDate: data.conversionDate ?? bounds.periodEnd,
        },
      });
      context.log.info(
        {
          period,
          batchId: batch.id,
          earningEntriesCreated: ingestion.created.length,
          payoutItems: batch.items.length,
          totalAmountLuma: batch.totalAmountMinor,
          fxRate: batch.fx?.rate,
          fxSource: batch.fx?.source,
          conversionDate: batch.fx?.conversionDate,
        },
        "generated reconciled monthly AMD payout report",
      );
    } catch (error: unknown) {
      if (
        error instanceof PayoutError &&
        (error.code === "EMPTY_BATCH" || error.code === "DUPLICATE_BATCH")
      ) {
        context.log.info(
          { period, outcome: error.code },
          "monthly payout report required no new batch",
        );
        return;
      }
      throw error;
    }
  },
  options: {
    repeat: { pattern: "0 2 1 * *" },
    repeatPayload: {},
  },
});
