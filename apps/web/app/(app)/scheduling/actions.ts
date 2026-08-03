"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { z } from "zod";

import { SchedulingError } from "../../../../../packages/domain/scheduling/errors";
import { zonedTimeToUtc, type Weekday } from "../../../../../packages/domain/scheduling/recurrence";
import {
  cancelLesson,
  completeLesson,
  createLessonSeries,
  recordAttendance,
  recordNoShow,
  rescheduleLesson,
  scheduleOneTimeLesson,
  setLessonZoomMeeting,
} from "../../../../../packages/domain/scheduling/services";
import type { SchedulingActionState } from "./action-state";
import { currentSchedulingContext } from "./context";

function str(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function nullableStr(formData: FormData, key: string): string | null {
  const value = str(formData, key);
  return value === "" ? null : value;
}

function checked(formData: FormData, key: string): boolean {
  return formData.get(key) === "on" || formData.get(key) === "true";
}

function parseDateAndTimeToUtc(
  formData: FormData,
  dateKey: string,
  timeKey: string,
  timezone: string,
): Date {
  const [year, month, day] = str(formData, dateKey).split("-").map(Number);
  const [hour, minute] = str(formData, timeKey).split(":").map(Number);
  if (!year || !month || !day || hour === undefined || minute === undefined) {
    throw new z.ZodError([
      { code: "custom", path: [dateKey], message: "A valid date and time are required." },
    ]);
  }
  return zonedTimeToUtc(year, month, day, hour, minute, timezone);
}

function errorState(error: unknown): SchedulingActionState {
  if (error instanceof z.ZodError) {
    return { status: "error", message: "errors.invalid", fieldErrors: error.flatten().fieldErrors };
  }
  if (error instanceof SchedulingError) {
    const message: SchedulingActionState["message"] =
      error.code === "UNAUTHENTICATED"
        ? "errors.unauthenticated"
        : error.code === "FORBIDDEN"
          ? "errors.forbidden"
          : error.code === "LESSON_NOT_FOUND" ||
              error.code === "ASSIGNMENT_NOT_FOUND" ||
              error.code === "LESSON_SERIES_NOT_FOUND"
            ? "errors.notFound"
            : error.code === "LESSON_ALREADY_RESOLVED" ||
                error.code === "LESSON_NOT_SCHEDULED" ||
                error.code === "ASSIGNMENT_INACTIVE"
              ? "errors.conflict"
              : error.status < 500
                ? "errors.invalid"
                : "errors.generic";
    return { status: "error", message, fieldErrors: {} };
  }
  return { status: "error", message: "errors.generic", fieldErrors: {} };
}

export async function createOneTimeLessonAction(
  _previous: SchedulingActionState,
  formData: FormData,
): Promise<SchedulingActionState> {
  try {
    const context = await currentSchedulingContext();
    const timezoneAtBooking = str(formData, "timezoneAtBooking");
    const lesson = await scheduleOneTimeLesson(context.database, context.actor, {
      tutorStudentAssignmentId: str(formData, "tutorStudentAssignmentId"),
      subjectId: str(formData, "subjectId"),
      scheduledStartAt: parseDateAndTimeToUtc(formData, "date", "time", timezoneAtBooking),
      durationMinutes: Number(str(formData, "durationMinutes") || "60"),
      timezoneAtBooking,
      isTrial: checked(formData, "isTrial"),
      additionalParticipantUserIds: [],
    });
    revalidatePath("/scheduling");
    redirect(`/scheduling/${lesson.id}`);
  } catch (error: unknown) {
    // Must run before errorState(): redirect() throws a NEXT_REDIRECT signal that this catch
    // would otherwise swallow, turning a successful create/reschedule into a false error.
    unstable_rethrow(error);
    return errorState(error);
  }
}

export async function createLessonSeriesAction(
  _previous: SchedulingActionState,
  formData: FormData,
): Promise<SchedulingActionState> {
  try {
    const context = await currentSchedulingContext();
    const byDay = formData
      .getAll("byDay")
      .filter((v): v is string => typeof v === "string") as Weekday[];
    const { series } = await createLessonSeries(context.database, context.actor, {
      tutorStudentAssignmentId: str(formData, "tutorStudentAssignmentId"),
      subjectId: str(formData, "subjectId"),
      startDate: str(formData, "startDate"),
      endDate: nullableStr(formData, "endDate"),
      durationMinutes: Number(str(formData, "durationMinutes") || "60"),
      recurrence: {
        interval: Number(str(formData, "interval") || "1"),
        byDay,
        hour: Number(str(formData, "hour") || "0"),
        minute: Number(str(formData, "minute") || "0"),
        timezone: str(formData, "timezone"),
      },
      additionalParticipantUserIds: [],
    });
    revalidatePath("/scheduling");
    redirect(`/scheduling?series=${series.id}`);
  } catch (error: unknown) {
    // Must run before errorState(): redirect() throws a NEXT_REDIRECT signal that this catch
    // would otherwise swallow, turning a successful create/reschedule into a false error.
    unstable_rethrow(error);
    return errorState(error);
  }
}

export async function cancelLessonAction(
  _previous: SchedulingActionState,
  formData: FormData,
): Promise<SchedulingActionState> {
  try {
    const context = await currentSchedulingContext();
    const lessonId = str(formData, "lessonId");
    await cancelLesson(context.database, context.actor, lessonId, {
      category: str(formData, "category") as
        "parent_request" | "tutor_request" | "admin_action" | "technical_issue" | "other",
      reason: str(formData, "reason"),
    });
    revalidatePath("/scheduling");
    revalidatePath(`/scheduling/${lessonId}`);
    return { status: "success", message: "canceled", fieldErrors: {} };
  } catch (error: unknown) {
    // Must run before errorState(): redirect() throws a NEXT_REDIRECT signal that this catch
    // would otherwise swallow, turning a successful create/reschedule into a false error.
    unstable_rethrow(error);
    return errorState(error);
  }
}

export async function rescheduleLessonAction(
  _previous: SchedulingActionState,
  formData: FormData,
): Promise<SchedulingActionState> {
  try {
    const context = await currentSchedulingContext();
    const lessonId = str(formData, "lessonId");
    const timezone = str(formData, "timezone");
    const { next } = await rescheduleLesson(context.database, context.actor, lessonId, {
      newScheduledStartAt: parseDateAndTimeToUtc(formData, "date", "time", timezone),
      durationMinutes: Number(str(formData, "durationMinutes") || "60"),
      reason: str(formData, "reason"),
    });
    revalidatePath("/scheduling");
    revalidatePath(`/scheduling/${lessonId}`);
    redirect(`/scheduling/${next.id}`);
  } catch (error: unknown) {
    // Must run before errorState(): redirect() throws a NEXT_REDIRECT signal that this catch
    // would otherwise swallow, turning a successful create/reschedule into a false error.
    unstable_rethrow(error);
    return errorState(error);
  }
}

export async function recordNoShowAction(
  _previous: SchedulingActionState,
  formData: FormData,
): Promise<SchedulingActionState> {
  try {
    const context = await currentSchedulingContext();
    const lessonId = str(formData, "lessonId");
    await recordNoShow(context.database, context.actor, lessonId, {
      party: str(formData, "party") as "student" | "tutor",
      reason: str(formData, "reason"),
    });
    revalidatePath(`/scheduling/${lessonId}`);
    return { status: "success", message: "noShowRecorded", fieldErrors: {} };
  } catch (error: unknown) {
    // Must run before errorState(): redirect() throws a NEXT_REDIRECT signal that this catch
    // would otherwise swallow, turning a successful create/reschedule into a false error.
    unstable_rethrow(error);
    return errorState(error);
  }
}

export async function recordAttendanceAction(
  _previous: SchedulingActionState,
  formData: FormData,
): Promise<SchedulingActionState> {
  try {
    const context = await currentSchedulingContext();
    const lessonId = str(formData, "lessonId");
    await recordAttendance(context.database, context.actor, lessonId, {
      studentProfileId: str(formData, "studentProfileId"),
      status: str(formData, "status") as "present" | "absent" | "late" | "excused",
      notes: nullableStr(formData, "notes"),
    });
    revalidatePath(`/scheduling/${lessonId}`);
    return { status: "success", message: "attendanceRecorded", fieldErrors: {} };
  } catch (error: unknown) {
    // Must run before errorState(): redirect() throws a NEXT_REDIRECT signal that this catch
    // would otherwise swallow, turning a successful create/reschedule into a false error.
    unstable_rethrow(error);
    return errorState(error);
  }
}

export async function completeLessonAction(
  _previous: SchedulingActionState,
  formData: FormData,
): Promise<SchedulingActionState> {
  try {
    const context = await currentSchedulingContext();
    const lessonId = str(formData, "lessonId");
    await completeLesson(context.database, context.actor, lessonId);
    revalidatePath(`/scheduling/${lessonId}`);
    return { status: "success", message: "completed", fieldErrors: {} };
  } catch (error: unknown) {
    // Must run before errorState(): redirect() throws a NEXT_REDIRECT signal that this catch
    // would otherwise swallow, turning a successful create/reschedule into a false error.
    unstable_rethrow(error);
    return errorState(error);
  }
}

export async function setZoomMeetingAction(
  _previous: SchedulingActionState,
  formData: FormData,
): Promise<SchedulingActionState> {
  try {
    const context = await currentSchedulingContext();
    const lessonId = str(formData, "lessonId");
    await setLessonZoomMeeting(context.database, context.actor, lessonId, {
      joinUrl: str(formData, "joinUrl"),
      passcode: nullableStr(formData, "passcode"),
      startUrl: nullableStr(formData, "startUrl"),
      zoomMeetingId: nullableStr(formData, "zoomMeetingId"),
    });
    revalidatePath(`/scheduling/${lessonId}`);
    return { status: "success", message: "zoomSaved", fieldErrors: {} };
  } catch (error: unknown) {
    // Must run before errorState(): redirect() throws a NEXT_REDIRECT signal that this catch
    // would otherwise swallow, turning a successful create/reschedule into a false error.
    unstable_rethrow(error);
    return errorState(error);
  }
}
