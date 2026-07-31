import { redirect } from "next/navigation";

import { SchedulingError } from "../../../../../packages/domain/scheduling/errors";
import type { LessonDetail, LessonRecord } from "../../../../../packages/domain/scheduling/models";
import {
  getLessonDetail,
  listLessonsForActor,
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
