import { createDb } from "@app/db";
import { createDrizzleGamificationDatabase } from "../../../../../packages/domain/gamification/drizzle-database";
import { reconcileSeasonalChallengeStatuses } from "../../../../../packages/domain/gamification/services";
import { defineJob } from "../../job";
import { isObject, objectSchema } from "../notifications/_schema";

const schema = objectSchema<Record<string, never>>(
  (value): value is Record<string, never> => isObject(value) && Object.keys(value).length === 0,
);

/** Maintains seasonal challenge dates only; it never creates engagement reminders or notifications. */
export default defineJob({
  name: "gamification.reconcile-seasonal-challenges",
  queue: "gamification",
  schema,
  async handler(_data, context) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl)
      throw new Error("DATABASE_URL is required for gamification challenge reconciliation.");
    const changed = await reconcileSeasonalChallengeStatuses(
      createDrizzleGamificationDatabase(createDb(databaseUrl)),
    );
    context.log.info({ changed }, "reconciled seasonal challenge statuses");
  },
  options: { repeat: { pattern: "7 2 * * *" }, repeatPayload: {}, idempotent: false },
});
