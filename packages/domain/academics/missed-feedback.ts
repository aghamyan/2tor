import { lessonFeedback, lessons, notifications, roles, userRoles, type Database } from "@app/db";
import { and, eq, inArray, isNull, lt } from "drizzle-orm";
import { ulid } from "ulid";

/** Creates one in-app admin alert per overdue lesson, making every run safe to repeat. */
export async function sendMissedFeedbackReminders(
  database: Database,
  options: { deadlineHours: number; scanLimit: number },
): Promise<number> {
  const deadline = new Date(Date.now() - options.deadlineHours * 60 * 60 * 1000);
  const missing = await database
    .select({ id: lessons.id })
    .from(lessons)
    .leftJoin(lessonFeedback, eq(lessonFeedback.lessonId, lessons.id))
    .where(
      and(
        eq(lessons.status, "completed"),
        lt(lessons.scheduledEndAt, deadline),
        isNull(lessonFeedback.id),
      ),
    )
    .limit(options.scanLimit);
  if (!missing.length) return 0;
  const admins = await database
    .selectDistinct({ userId: userRoles.userId })
    .from(userRoles)
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .where(
      and(
        inArray(roles.key, ["administrator", "super_administrator"]),
        isNull(userRoles.revokedAt),
      ),
    );
  let created = 0;
  for (const lesson of missing)
    for (const admin of admins) {
      const [alreadyAlerted] = await database
        .select({ id: notifications.id })
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, admin.userId),
            eq(notifications.category, "academics.missed_feedback"),
            eq(notifications.relatedEntityType, "lesson"),
            eq(notifications.relatedEntityId, lesson.id),
          ),
        )
        .limit(1);
      if (!alreadyAlerted) {
        await database.insert(notifications).values({
          id: ulid(),
          userId: admin.userId,
          channel: "in_app",
          category: "academics.missed_feedback",
          title: "Lesson feedback overdue",
          body: `Completed lesson ${lesson.id} has no published feedback after the deadline.`,
          status: "sent",
          sentAt: new Date(),
          relatedEntityType: "lesson",
          relatedEntityId: lesson.id,
        });
        created += 1;
      }
    }
  return created;
}
