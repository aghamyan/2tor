import {
  lessons,
  tutorStudentAssignments,
  whatsappGroups,
  whatsappLessonNotifications,
  type Database,
} from "@app/db";
import { and, eq, gte, isNull, lte } from "drizzle-orm";
import { ulid } from "ulid";

/**
 * Candidate scans for the two worker sweep jobs (`apps/worker/src/jobs/whatsapp`). Read-only,
 * `@app/db`-direct — mirrors `packages/domain/scheduling/reminders.ts`'s pattern (this is invoked
 * only from `apps/worker`, which has `@app/whatsapp` as a declared dependency to actually send).
 *
 * Unlike scheduling's fixed 24h/1h windows, the reminder lead time is a **per-student column**
 * (`whatsappGroups.reminderLeadMinutes`), so the tolerance band can't be computed once in JS
 * before querying — it varies per row. Rather than building the comparison in raw SQL (interval
 * arithmetic keyed off a joined column), this fetches every enabled group's lesson inside the
 * widest possible horizon (the largest selectable lead time, `WHATSAPP_REMINDER_LEAD_MINUTES_OPTIONS`'
 * max of 1440 minutes, plus tolerance) and applies the precise per-row tolerance check in
 * application code. The result is identical to computing it in SQL; it's just easier to get right.
 */

export interface WhatsAppReminderCandidate {
  lessonId: string;
  providerGroupId: string;
  scheduledStartAt: Date;
  reminderLeadMinutes: number;
}

export interface WhatsAppClassEndedCandidate {
  lessonId: string;
  providerGroupId: string;
  scheduledEndAt: Date;
}

/**
 * Half-open tolerance around the target instant, same purpose as
 * `packages/domain/scheduling/reminders.ts`'s `TOLERANCE_MINUTES`: must be at least half the
 * worker job's poll interval (5 minutes) so consecutive scans jointly cover every instant with no
 * gap. The `whatsapp_lesson_notifications` marker makes the resulting overlap harmless.
 */
const TOLERANCE_MINUTES = 6;
/** Must stay in sync with `WHATSAPP_REMINDER_LEAD_MINUTES_OPTIONS`'s max (`packages/domain/whatsapp/schemas.ts`). */
const MAX_REMINDER_LEAD_MINUTES = 1440;

/**
 * Extracted as a pure, DB-free function so the tolerance-band math is unit-testable directly —
 * same rationale as `packages/domain/scheduling/reminders.ts` only unit-testing
 * `reminderWindowBounds`, not the live query. Symmetric ±`TOLERANCE_MINUTES` band around the
 * target instant (`now + reminderLeadMinutes`).
 */
export function isWithinReminderTolerance(
  scheduledStartAt: Date,
  now: Date,
  reminderLeadMinutes: number,
): boolean {
  const minutesUntilStart = (scheduledStartAt.getTime() - now.getTime()) / 60_000;
  return Math.abs(minutesUntilStart - reminderLeadMinutes) <= TOLERANCE_MINUTES;
}

export async function findLessonsNeedingWhatsAppReminder(
  database: Database,
  now: Date = new Date(),
): Promise<WhatsAppReminderCandidate[]> {
  const horizon = new Date(now.getTime() + (MAX_REMINDER_LEAD_MINUTES + TOLERANCE_MINUTES) * 60_000);
  const rows = await database
    .select({
      lessonId: lessons.id,
      providerGroupId: whatsappGroups.providerGroupId,
      scheduledStartAt: lessons.scheduledStartAt,
      reminderLeadMinutes: whatsappGroups.reminderLeadMinutes,
    })
    .from(lessons)
    .innerJoin(
      tutorStudentAssignments,
      eq(tutorStudentAssignments.id, lessons.tutorStudentAssignmentId),
    )
    .innerJoin(
      whatsappGroups,
      eq(whatsappGroups.studentProfileId, tutorStudentAssignments.studentProfileId),
    )
    .leftJoin(whatsappLessonNotifications, eq(whatsappLessonNotifications.lessonId, lessons.id))
    .where(
      and(
        eq(lessons.status, "scheduled"),
        eq(whatsappGroups.isEnabled, true),
        eq(whatsappGroups.status, "active"),
        isNull(whatsappLessonNotifications.reminderSentAt),
        gte(lessons.scheduledStartAt, now),
        lte(lessons.scheduledStartAt, horizon),
      ),
    );

  return rows.filter(
    (row): row is typeof row & { providerGroupId: string } =>
      row.providerGroupId !== null &&
      isWithinReminderTolerance(row.scheduledStartAt, now, row.reminderLeadMinutes),
  );
}

export async function markWhatsAppReminderSent(database: Database, lessonId: string): Promise<void> {
  await database
    .insert(whatsappLessonNotifications)
    .values({ id: ulid(), lessonId, reminderSentAt: new Date() })
    .onConflictDoUpdate({
      target: whatsappLessonNotifications.lessonId,
      set: { reminderSentAt: new Date() },
    });
}

/**
 * No lower bound on `scheduledEndAt`, unlike the reminder scan — a "your class has ended" message
 * is still correct and useful even if delivered late (e.g. after a worker outage), unlike a
 * "starting soon" reminder for a lesson that already happened. Idempotency comes entirely from the
 * `classEndedSentAt` marker, not from a time-window exclusivity.
 */
export async function findLessonsNeedingClassEndedNotice(
  database: Database,
  now: Date = new Date(),
): Promise<WhatsAppClassEndedCandidate[]> {
  const rows = await database
    .select({
      lessonId: lessons.id,
      providerGroupId: whatsappGroups.providerGroupId,
      scheduledEndAt: lessons.scheduledEndAt,
    })
    .from(lessons)
    .innerJoin(
      tutorStudentAssignments,
      eq(tutorStudentAssignments.id, lessons.tutorStudentAssignmentId),
    )
    .innerJoin(
      whatsappGroups,
      eq(whatsappGroups.studentProfileId, tutorStudentAssignments.studentProfileId),
    )
    .leftJoin(whatsappLessonNotifications, eq(whatsappLessonNotifications.lessonId, lessons.id))
    .where(
      and(
        eq(whatsappGroups.isEnabled, true),
        eq(whatsappGroups.status, "active"),
        isNull(whatsappLessonNotifications.classEndedSentAt),
        lte(lessons.scheduledEndAt, now),
      ),
    );

  return rows.filter(
    (row): row is typeof row & { providerGroupId: string } => row.providerGroupId !== null,
  );
}

export async function markWhatsAppClassEndedSent(database: Database, lessonId: string): Promise<void> {
  await database
    .insert(whatsappLessonNotifications)
    .values({ id: ulid(), lessonId, classEndedSentAt: new Date() })
    .onConflictDoUpdate({
      target: whatsappLessonNotifications.lessonId,
      set: { classEndedSentAt: new Date() },
    });
}
