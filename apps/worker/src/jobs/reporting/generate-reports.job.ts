import { createDb } from "@app/db";
import { createDrizzleReportingRepository } from "../../../../../packages/domain/reporting/drizzle-repository";
import { previousPeriod } from "../../../../../packages/domain/reporting/periods";
import { generateAndStoreReportingSnapshot } from "../../../../../packages/domain/reporting/services";
import type { ReportingCadence } from "../../../../../packages/domain/reporting/models";
import { defineJob } from "../../job";
import { isObject, objectSchema } from "../notifications/_schema";

type Payload = { anchor?: string };
const schema = objectSchema<Payload>(
  (value): value is Payload =>
    isObject(value) &&
    (value.anchor === undefined ||
      (typeof value.anchor === "string" && !Number.isNaN(new Date(value.anchor).getTime()))),
);

function reportJob(cadence: ReportingCadence, pattern: string) {
  return defineJob({
    name: `reporting.generate-${cadence}`,
    queue: "reporting",
    schema,
    async handler(data, context) {
      const databaseUrl = process.env.DATABASE_URL;
      if (!databaseUrl) throw new Error("DATABASE_URL is required for report generation.");
      const generatedAt = data.anchor ? new Date(data.anchor) : new Date();
      const period = previousPeriod(cadence, generatedAt);
      const snapshot = await generateAndStoreReportingSnapshot(
        createDrizzleReportingRepository(createDb(databaseUrl)),
        cadence,
        period,
        generatedAt,
      );
      context.log.info(
        {
          cadence,
          periodStart: snapshot.period.start,
          periodEnd: snapshot.period.end,
          minimumCohortSize: snapshot.privacy.minimumCohortSize,
        },
        "privacy-preserving aggregate report generated",
      );
    },
    options: {
      repeat: { pattern },
      repeatPayload: {},
      idempotent: false,
    },
  });
}

/** Every Monday at 02:10 UTC, after the prior UTC week has closed. */
export const weeklyReportingJob = reportJob("weekly", "10 2 * * 1");

/** On the first day of each month at 03:10 UTC, after the prior UTC month has closed. */
export const monthlyReportingJob = reportJob("monthly", "10 3 1 * *");
