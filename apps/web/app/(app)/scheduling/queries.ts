import { redirect } from "next/navigation";

import { AcademicError } from "../../../../../packages/domain/academics/errors";
import type { ParentVisibleFeedback } from "../../../../../packages/domain/academics/models";
import { getParentVisibleFeedback } from "../../../../../packages/domain/academics/services";
import { SchedulingError } from "../../../../../packages/domain/scheduling/errors";
import type {
  LessonDetail,
  LessonRecord,
  SchedulableAssignmentOption,
  SubjectOption,
} from "../../../../../packages/domain/scheduling/models";
import {
  getLessonDetail,
  listLessonsForActor,
  listSchedulableAssignments,
  listSchedulableSubjects,
} from "../../../../../packages/domain/scheduling/services";
import { currentAcademicContext } from "../academics/context";
import { currentSchedulingContext } from "./context";

const DAY_MS = 24 * 60 * 60 * 1000;

function redirectIfUnauthenticated(error: unknown): never {
  if (error instanceof SchedulingError && error.code === "UNAUTHENTICATED") redirect("/login");
  throw error;
}

/** Lessons from yesterday through 60 days out. A brand-new parent/tutor with no schedulable relationship yet sees an empty list, not an error. */
export async function loadUpcomingLessons(): Promise<LessonRecord[]> {
  try {
    const context = await currentSchedulingContext();
    return await listLessonsForActor(context.database, context.actor, {
      from: new Date(Date.now() - DAY_MS),
      to: new Date(Date.now() + 60 * DAY_MS),
      limit: 100,
    });
  } catch (error: unknown) {
    if (error instanceof SchedulingError && error.code === "FORBIDDEN") return [];
    return redirectIfUnauthenticated(error);
  }
}

/** List data for the Classes workspace. The meeting link is intentionally resolved here rather
 * than making every card fetch its own detail page; that keeps the primary join action immediate. */
export type ClassListRecord = LessonRecord & { joinUrl: string | null };

export async function loadClassesForViewer(): Promise<ClassListRecord[]> {
  try {
    const context = await currentSchedulingContext();
    const lessons = await listLessonsForActor(context.database, context.actor, {
      from: new Date(Date.now() - DAY_MS),
      to: new Date(Date.now() + 60 * DAY_MS),
      limit: 100,
    });
    const meetingUrls = await Promise.all(
      lessons.map(async (lesson) => {
        if (lesson.status !== "scheduled") return null;
        return (await context.database.findZoomMeetingByLessonId(lesson.id))?.joinUrl ?? null;
      }),
    );
    return lessons.map((lesson, index) => ({ ...lesson, joinUrl: meetingUrls[index] ?? null }));
  } catch (error: unknown) {
    if (error instanceof SchedulingError && error.code === "FORBIDDEN") return [];
    return redirectIfUnauthenticated(error);
  }
}

/** A bounded history window used by role dashboards for completed-class recaps. */
export async function loadRecentLessons(days = 180): Promise<LessonRecord[]> {
  try {
    const context = await currentSchedulingContext();
    return await listLessonsForActor(context.database, context.actor, {
      from: new Date(Date.now() - days * DAY_MS),
      to: new Date(),
      limit: 250,
    });
  } catch (error: unknown) {
    if (error instanceof SchedulingError && error.code === "FORBIDDEN") return [];
    return redirectIfUnauthenticated(error);
  }
}

export interface SchedulableOptions {
  assignments: SchedulableAssignmentOption[];
  subjects: SubjectOption[];
}

/** Populates the new-lesson form's student and subject pickers. A viewer who can't schedule
 * (parent/student) sees empty lists rather than an error — the form itself is only linked to from
 * the tutor view, so this is a defensive fallback, not the access-control boundary. */
export async function loadSchedulableOptions(): Promise<SchedulableOptions> {
  try {
    const context = await currentSchedulingContext();
    const [assignments, subjects] = await Promise.all([
      listSchedulableAssignments(context.database, context.actor),
      listSchedulableSubjects(context.database, context.actor),
    ]);
    return { assignments, subjects };
  } catch (error: unknown) {
    if (error instanceof SchedulingError && error.code === "FORBIDDEN") {
      return { assignments: [], subjects: [] };
    }
    return redirectIfUnauthenticated(error);
  }
}

export async function loadLessonDetail(lessonId: string): Promise<LessonDetail> {
  try {
    const context = await currentSchedulingContext();
    return await getLessonDetail(context.database, context.actor, lessonId);
  } catch (error: unknown) {
    return redirectIfUnauthenticated(error);
  }
}

export interface LessonDetailForViewer {
  detail: LessonDetail;
  viewerUserId: string;
  isStaff: boolean;
  /** The tutor's published recap for this lesson, already filtered to what this viewer is allowed to see (visibility flags, staff-only note stripped) — `null` if none exists yet, or none is visible to this viewer. */
  feedback: ParentVisibleFeedback | null;
}

/**
 * `getFeedbackForLesson` finds the record; `getParentVisibleFeedback` re-checks per-viewer access
 * (role, family link, and the tutor's parent/student visibility choice) and strips staff-only
 * content. A viewer with no access — including "the record exists but wasn't shared with you" —
 * sees `null` here rather than an error, matching how the rest of this page treats absent detail.
 * `studentProfileId` comes from the scheduling actor rather than the academic session (which never
 * carries it for a real request) so a student viewer's half of the tutor's visibility choice
 * actually has an effect, not just the parent half.
 */
async function loadLessonFeedbackForViewer(
  lessonId: string,
  studentProfileId: string | null,
): Promise<ParentVisibleFeedback | null> {
  try {
    const academicContext = await currentAcademicContext();
    const record = await academicContext.database.getFeedbackForLesson(lessonId);
    if (!record) return null;
    const actor = studentProfileId
      ? { ...academicContext.actor, studentProfileId }
      : academicContext.actor;
    return await getParentVisibleFeedback(academicContext.database, actor, record.id);
  } catch (error: unknown) {
    if (error instanceof AcademicError) return null;
    throw error;
  }
}

export async function loadLessonDetailForViewer(lessonId: string): Promise<LessonDetailForViewer> {
  try {
    const context = await currentSchedulingContext();
    const [detail, studentProfileId] = await Promise.all([
      getLessonDetail(context.database, context.actor, lessonId),
      context.database.resolveStudentProfileIdForUser(context.actor.userId),
    ]);
    const feedback = await loadLessonFeedbackForViewer(lessonId, studentProfileId);
    const isStaff =
      context.actor.roles.includes("administrator") ||
      context.actor.roles.includes("super_administrator");
    return { detail, viewerUserId: context.actor.userId, isStaff, feedback };
  } catch (error: unknown) {
    return redirectIfUnauthenticated(error);
  }
}
