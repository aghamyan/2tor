import { createDb } from "@app/db";
import { notify } from "@app/notifications";

import { defineJob } from "../../job";
import { isObject, objectSchema } from "../notifications/_schema";
import {
  findLessonsNeedingReminder,
  type ReminderWindow,
} from "../../../../../packages/domain/scheduling/reminders";
import { ensureSchedulingNotificationsConfigured } from "./_notifications";

type Payload = Record<string, never>;

const schema = objectSchema<Payload>((value): value is Payload => isObject(value));

const REMINDER_WINDOWS: readonly ReminderWindow[] = ["24h", "1h"];

function reminderActionUrl(lessonId: string, window: ReminderWindow): string {
  const base = process.env.APP_BASE_URL ?? "";
  return `${base}/scheduling/${lessonId}?reminder=${window}`;
}

/**
 * Scans for lessons starting ~24h and ~1h out (spec §17) and sends `lesson_reminder`
 * notifications to every participant. Runs every 5 minutes; `findLessonsNeedingReminder`'s ±6min
 * tolerance band guarantees no lesson falls through the gap between two consecutive ticks (see
 * reminders.ts).
 *
 * Deliberately varies the rendered `actionUrl` (and so the rendered body) between the two
 * windows and omits `relatedEntity` — `notifications.create-inbox`'s idempotency key falls back
 * to the rendered body when no related entity is given, so the 24h and 1h reminders for the same
 * lesson are treated as distinct notifications, not duplicate retries of each other. See
 * README.md, "Known limitations," for the one channel (web push) where this repo's current
 * idempotency-key design still can't make that distinction.
 */
export default defineJob({
  name: "scheduling.send-reminders",
  queue: "scheduling",
  schema,
  async handler(_data, context) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) throw new Error("DATABASE_URL is required for scheduling reminders.");
    const db = createDb(databaseUrl);
    ensureSchedulingNotificationsConfigured(db);

    for (const window of REMINDER_WINDOWS) {
      const candidates = await findLessonsNeedingReminder(db, window);
      for (const candidate of candidates) {
        await notify({
          userId: candidate.userId,
          type: "lesson_reminder",
          data: { actionUrl: reminderActionUrl(candidate.lessonId, window) },
        });
      }
      context.log.info(
        { window, candidateCount: candidates.length },
        "lesson reminders dispatched",
      );
    }
  },
  options: {
    repeat: { pattern: "*/5 * * * *" },
    repeatPayload: {},
  },
});
