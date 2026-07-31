import { createDb, notifications } from "@app/db";
import { createDrizzleAssignmentsDatabase } from "../../../../../packages/domain/assignments/drizzle-database";
import { findStaleAssignmentReminders } from "../../../../../packages/domain/assignments/services";
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

/** Runs hourly and surfaces overdue unpublished work for the notification dispatcher without changing submission state. */
export default defineJob({
  name: "assignments.stale-assignment-reminder",
  queue: "assignments",
  schema,
  async handler(data, context) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) throw new Error("DATABASE_URL is required for stale assignment reminders.");
    const db = createDb(databaseUrl);
    const reminders = await findStaleAssignmentReminders(
      createDrizzleAssignmentsDatabase(db),
      new Date(),
      data.scanLimit ?? 250,
    );
    if (!reminders.length) context.log.info("no stale assignments found");
    else {
      await db.insert(notifications).values(
        reminders.map((reminder) => ({
          id: crypto.randomUUID(),
          userId: reminder.studentUserId,
          channel: "in_app" as const,
          category: "assignments",
          title: "Assignment overdue",
          body: "You have an assignment awaiting submission.",
          status: "pending" as const,
          relatedEntityType: "assignment",
          relatedEntityId: reminder.assignmentId,
        })),
      );
      context.log.warn({ reminderCount: reminders.length }, "stale assignment reminders queued");
    }
  },
  options: { repeat: { pattern: "0 9 * * *" }, repeatPayload: {}, idempotent: false },
});
