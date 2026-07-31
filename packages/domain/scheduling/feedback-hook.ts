import { lessons, type Database } from "@app/db";
import { and, asc, eq, lt } from "drizzle-orm";

/**
 * Missed-feedback alerting hook for D6 (Academic), per spec §5.2: "Admin is alerted if feedback is
 * missing after the defined deadline." Scheduling owns lesson status, not feedback — `lesson_
 * feedback` is Academic's table, and this module has no visibility into whether feedback was
 * actually submitted. This query only answers the scheduling half of the question: "which lessons
 * completed more than N hours ago." D6 is expected to left-join this list against its own
 * `lesson_feedback` table to find which of them are still missing feedback, then alert.
 */

export interface RecentlyCompletedLesson {
  lessonId: string;
  tutorStudentAssignmentId: string;
  scheduledStartAt: Date;
  /** When the lesson's status last changed to `"completed"` — approximated by `lessons.updated_at`, the only timestamp available on this row. */
  completedAt: Date;
}

export interface RecentlyCompletedLessonsOptions {
  /** Only lessons completed at least this many hours ago. */
  completedAtLeastHoursAgo: number;
  limit?: number;
}

export async function getRecentlyCompletedLessons(
  database: Database,
  options: RecentlyCompletedLessonsOptions,
): Promise<RecentlyCompletedLesson[]> {
  const threshold = new Date(Date.now() - options.completedAtLeastHoursAgo * 60 * 60 * 1000);
  const rows = await database
    .select({
      lessonId: lessons.id,
      tutorStudentAssignmentId: lessons.tutorStudentAssignmentId,
      scheduledStartAt: lessons.scheduledStartAt,
      completedAt: lessons.updatedAt,
    })
    .from(lessons)
    .where(and(eq(lessons.status, "completed"), lt(lessons.updatedAt, threshold)))
    .orderBy(asc(lessons.updatedAt))
    .limit(options.limit ?? 200);
  return rows;
}
