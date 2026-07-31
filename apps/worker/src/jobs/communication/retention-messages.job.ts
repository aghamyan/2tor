import { createDb } from "@app/db";

import { createDrizzleCommunicationDatabase } from "../../../../../packages/domain/communication/drizzle-database";
import { enforceOrdinaryMessageRetention } from "../../../../../packages/domain/communication/retention";
import { createS3CommunicationStorage } from "../../../../../packages/domain/communication/storage";
import { defineJob } from "../../job";
import { isObject, objectSchema } from "../notifications/_schema";

type Payload = { limit?: number };
const schema = objectSchema<Payload>(
  (value): value is Payload =>
    isObject(value) &&
    (value.limit === undefined ||
      (typeof value.limit === "number" &&
        Number.isInteger(value.limit) &&
        value.limit >= 1 &&
        value.limit <= 1_000)),
);

/**
 * Ordinary messages become eligible only when every active participant account has been inactive
 * for two years. The domain query excludes abuse-report and incident evidence.
 */
export default defineJob({
  name: "communication.retention-messages",
  queue: "communication",
  schema,
  async handler(data, context) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error("DATABASE_URL is required for communication retention.");
    }
    const result = await enforceOrdinaryMessageRetention(
      createDrizzleCommunicationDatabase(createDb(databaseUrl)),
      createS3CommunicationStorage(),
      { limit: data.limit ?? 250 },
    );
    context.log.info(result, "ordinary communication retention completed");
  },
  options: {
    repeat: { pattern: "0 3 * * 0" },
    repeatPayload: { limit: 250 },
  },
});
