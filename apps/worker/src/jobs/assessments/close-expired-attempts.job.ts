import { createDb } from "@app/db";
import { createDrizzleAssessmentDatabase } from "../../../../../packages/domain/assessments/drizzle-database";
import { closeExpiredAssessmentAttempts } from "../../../../../packages/domain/assessments/services";
import { defineJob } from "../../job";
import { isObject, objectSchema } from "../notifications/_schema";

type Payload = { scanLimit?: number };

const schema = objectSchema<Payload>(
  (value): value is Payload =>
    isObject(value) &&
    (value.scanLimit === undefined ||
      (typeof value.scanLimit === "number" &&
        Number.isInteger(value.scanLimit) &&
        value.scanLimit >= 1 &&
        value.scanLimit <= 1_000)),
);

/**
 * Closes timed attempts after their deadline. It preserves every saved answer and never derives
 * an integrity verdict from activity events.
 */
export default defineJob({
  name: "assessments.close-expired-attempts",
  queue: "assessments",
  schema,
  async handler(data, context) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) throw new Error("DATABASE_URL is required for timed assessment cleanup.");
    const closed = await closeExpiredAssessmentAttempts(
      createDrizzleAssessmentDatabase(createDb(databaseUrl)),
      new Date(),
      data.scanLimit ?? 250,
    );
    if (closed === 0) context.log.info("no expired assessment attempts found");
    else context.log.info({ closedAttemptCount: closed }, "expired assessment attempts closed");
  },
  options: {
    repeat: { pattern: "* * * * *" },
    repeatPayload: {},
    idempotent: false,
  },
});
