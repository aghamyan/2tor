import { createDb } from "@app/db";
import { sendMissedFeedbackReminders } from "../../../../../packages/domain/academics/missed-feedback";
import { defineJob } from "../../job";
import { isObject, objectSchema } from "../notifications/_schema";

type Payload = { deadlineHours?: number; scanLimit?: number };
const schema = objectSchema<Payload>(
  (value): value is Payload =>
    isObject(value) &&
    (value.deadlineHours === undefined ||
      (typeof value.deadlineHours === "number" &&
        Number.isInteger(value.deadlineHours) &&
        value.deadlineHours >= 1 &&
        value.deadlineHours <= 168)) &&
    (value.scanLimit === undefined ||
      (typeof value.scanLimit === "number" &&
        Number.isInteger(value.scanLimit) &&
        value.scanLimit >= 1 &&
        value.scanLimit <= 1000)),
);

/** Alerts administrators after a completed lesson passes its feedback deadline; it never writes feedback. */
export default defineJob({
  name: "academics.missed-feedback-reminder",
  queue: "academics",
  schema,
  async handler(data, context) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) throw new Error("DATABASE_URL is required for missed-feedback reminders.");
    const created = await sendMissedFeedbackReminders(createDb(databaseUrl), {
      deadlineHours: data.deadlineHours ?? 24,
      scanLimit: data.scanLimit ?? 250,
    });
    if (!created) context.log.info("no overdue lesson feedback found");
    else context.log.warn({ createdReminderCount: created }, "missed feedback reminders created");
  },
  options: { repeat: { pattern: "15 * * * *" }, repeatPayload: {}, idempotent: false },
});
