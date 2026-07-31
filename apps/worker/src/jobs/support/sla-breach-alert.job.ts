import { createDb } from "@app/db";
import { createDrizzleSupportDatabase } from "../../../../../packages/domain/support/drizzle-database";
import { alertOnSlaBreaches } from "../../../../../packages/domain/support/services";
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

/** Emits one structured operational alert per newly breached SLA and records the dedupe timestamp. */
export default defineJob({
  name: "support.sla-breach-alert",
  queue: "support",
  schema,
  async handler(data, context) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) throw new Error("DATABASE_URL is required for support SLA alerts.");
    const count = await alertOnSlaBreaches(
      createDrizzleSupportDatabase(createDb(databaseUrl)),
      {
        async alert({ ticket, breachedAt }) {
          context.log.error(
            {
              alert: "support.sla_breached",
              ticketId: ticket.id,
              category: ticket.category,
              priority: ticket.priority,
              slaTargetAt: ticket.slaTargetAt.toISOString(),
              breachedAt: breachedAt.toISOString(),
            },
            "support SLA breached",
          );
        },
      },
      new Date(),
      data.scanLimit ?? 250,
    );
    if (!count) context.log.info("no new support SLA breaches");
  },
  options: { repeat: { pattern: "*/5 * * * *" }, repeatPayload: {}, idempotent: false },
});
