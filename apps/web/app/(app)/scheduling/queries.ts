import { redirect } from "next/navigation";

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
}

export async function loadLessonDetailForViewer(lessonId: string): Promise<LessonDetailForViewer> {
  try {
    const context = await currentSchedulingContext();
    const detail = await getLessonDetail(context.database, context.actor, lessonId);
    const isStaff =
      context.actor.roles.includes("administrator") ||
      context.actor.roles.includes("super_administrator");
    return { detail, viewerUserId: context.actor.userId, isStaff };
  } catch (error: unknown) {
    return redirectIfUnauthenticated(error);
  }
}
