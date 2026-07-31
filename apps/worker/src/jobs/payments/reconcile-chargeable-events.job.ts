import { createDb } from "@app/db";

import { defineJob } from "../../job";
import { isObject, objectSchema } from "../notifications/_schema";
import { createDrizzlePaymentDatabase } from "../../../../../packages/domain/payments/drizzle-database";
import { invoiceChargeableEvent } from "../../../../../packages/domain/payments/services";
import { getChargeableLessonEvents } from "../../../../../packages/domain/scheduling/chargeable-events";

type Payload = { lookbackHours?: number };

const schema = objectSchema<Payload>(
  (value): value is Payload =>
    isObject(value) &&
    (value.lookbackHours === undefined ||
      (typeof value.lookbackHours === "number" &&
        Number.isInteger(value.lookbackHours) &&
        value.lookbackHours >= 1 &&
        value.lookbackHours <= 24 * 30)),
);

/**
 * Overlapping scans are deliberate. D5's lessonId uniqueness and Payments' deterministic write
 * IDs make every overlap a no-op while protecting against a crash between scheduled runs.
 */
export default defineJob({
  name: "payments.reconcile-chargeable-events",
  queue: "payments",
  schema,
  async handler(data, context) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) throw new Error("DATABASE_URL is required for payment reconciliation.");
    const database = createDb(databaseUrl);
    const paymentDatabase = createDrizzlePaymentDatabase(database);
    const lookbackHours = data.lookbackHours ?? 24 * 7;
    const events = await getChargeableLessonEvents(database, {
      since: new Date(Date.now() - lookbackHours * 60 * 60 * 1_000),
      limit: 500,
    });

    for (const event of events) {
      await invoiceChargeableEvent(paymentDatabase, event, {
        idempotencyKey: `d5-cancellation:${event.cancellationId}`,
      });
    }
    context.log.info(
      { events: events.length, lookbackHours },
      "reconciled D5 chargeable events into invoices",
    );
  },
  options: {
    repeat: { pattern: "*/5 * * * *" },
    repeatPayload: {},
  },
});
