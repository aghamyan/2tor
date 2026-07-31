import { lessonParticipants, lessons, type Database } from "@app/db";
import { and, asc, eq, gte, lt } from "drizzle-orm";

/**
 * Reminder candidate scan for the worker job (spec §17: "24-hour reminder," "1-hour reminder").
 * Read-only, `@app/db`-direct — mirrors `packages/domain/families/integrity.ts`'s pattern, since
 * this is invoked only from apps/worker (which has `@app/notifications` as a declared dependency
 * to actually send the reminder), never from anything vitest reaches through `services.ts`.
 *
 * Known limitation (see README, "Known limitations"): `@app/notifications`'
 * `notificationCategory("lesson_reminder")` collapses to one `"schedule"` category, so a
 * recipient's single notification preference gates both the 24h and 1h reminder — there's no way
 * to let a family opt into one but not the other without a change to `@app/notifications` or the
 * DB schema, both outside this module's allowed files.
 */

export type ReminderWindow = "24h" | "1h";

export interface ReminderCandidate {
  lessonId: string;
  userId: string;
  scheduledStartAt: Date;
}

const WINDOW_HOURS: Record<ReminderWindow, number> = { "24h": 24, "1h": 1 };

/**
 * Half-open tolerance around the target instant. Must be at least half the worker job's poll
 * interval so consecutive scans jointly cover every instant with no gap; the job's idempotency
 * key (`lessonId:userId:window`) makes the resulting overlap harmless (a lesson caught by two
 * consecutive scans is only ever notified once — see the job file).
 */
const TOLERANCE_MINUTES = 6;

export function reminderWindowBounds(
  window: ReminderWindow,
  now: Date,
): { start: Date; end: Date } {
  const targetMs = now.getTime() + WINDOW_HOURS[window] * 60 * 60 * 1000;
  return {
    start: new Date(targetMs - TOLERANCE_MINUTES * 60_000),
    end: new Date(targetMs + TOLERANCE_MINUTES * 60_000),
  };
}

/** Every (lesson, participant) pair whose lesson starts inside the `window`'s tolerance band around `now`. */
export async function findLessonsNeedingReminder(
  database: Database,
  window: ReminderWindow,
  now: Date = new Date(),
): Promise<ReminderCandidate[]> {
  const { start, end } = reminderWindowBounds(window, now);
  const rows = await database
    .select({
      lessonId: lessons.id,
      userId: lessonParticipants.userId,
      scheduledStartAt: lessons.scheduledStartAt,
    })
    .from(lessons)
    .innerJoin(lessonParticipants, eq(lessonParticipants.lessonId, lessons.id))
    .where(
      and(
        eq(lessons.status, "scheduled"),
        gte(lessons.scheduledStartAt, start),
        lt(lessons.scheduledStartAt, end),
      ),
    )
    .orderBy(asc(lessons.scheduledStartAt));
  return rows;
}
