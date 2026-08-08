import { ulid } from "ulid";

import {
  computeCancellationCharge,
  DEFAULT_CANCELLATION_POLICY,
  hoursBeforeLesson,
  initiatorFromCategory,
  lessonKindFrom,
  type CancellationCategory,
  type CancellationPolicyConfig,
} from "./cancellation-policy";
import { SchedulingError } from "./errors";
import type {
  AssignmentFact,
  AttendanceRecord,
  CancellationRecord,
  LessonDetail,
  LessonListScope,
  LessonRecord,
  LessonSeriesRecord,
  SchedulableAssignmentOption,
  SchedulingActor,
  SchedulingDatabase,
  SubjectOption,
  TutorZoomDefaults,
  ZoomMeetingRecord,
} from "./models";
import {
  expandOccurrences,
  formatCalendarDate,
  parseRecurrencePattern,
  serializeRecurrencePattern,
} from "./recurrence";
import {
  cancelLessonInputSchema,
  createLessonSeriesInputSchema,
  createOneTimeLessonInputSchema,
  deleteLessonInputSchema,
  deleteLessonSeriesInputSchema,
  recordAttendanceInputSchema,
  recordNoShowInputSchema,
  rescheduleLessonInputSchema,
  setZoomMeetingInputSchema,
  type CancelLessonInput,
  type CreateLessonSeriesInput,
  type CreateOneTimeLessonInput,
  type DeleteLessonInput,
  type DeleteLessonSeriesInput,
  type RecordAttendanceInput,
  type RecordNoShowInput,
  type RescheduleLessonInput,
  type SetZoomMeetingInput,
} from "./schemas";
import { createManualZoomLinkProvider, type ZoomLinkProvider } from "./zoom";

function requireAuthenticated(
  actor: SchedulingActor | null | undefined,
): asserts actor is SchedulingActor {
  if (!actor) throw new SchedulingError("UNAUTHENTICATED", "A signed-in actor is required.", 401);
}

function isStaff(actor: SchedulingActor): boolean {
  return actor.roles.includes("administrator") || actor.roles.includes("super_administrator");
}

function assertAssignmentActive(assignment: AssignmentFact): void {
  const now = Date.now();
  const active =
    assignment.status === "active" &&
    (assignment.endAt === null || assignment.endAt.getTime() > now);
  if (!active) {
    throw new SchedulingError(
      "ASSIGNMENT_INACTIVE",
      "This tutor-student assignment is not active.",
      409,
    );
  }
}

async function requireAssignment(
  database: SchedulingDatabase,
  assignmentId: string,
): Promise<AssignmentFact> {
  const assignment = await database.findAssignmentById(assignmentId);
  if (!assignment)
    throw new SchedulingError("ASSIGNMENT_NOT_FOUND", "Assignment was not found.", 404);
  return assignment;
}

/** Only the assignment's own tutor, or staff, may put new lessons on the calendar. */
async function requireCanSchedule(
  actor: SchedulingActor,
  assignment: AssignmentFact,
): Promise<void> {
  if (isStaff(actor)) return;
  if (actor.roles.includes("tutor") && actor.userId === assignment.tutorUserId) return;
  throw new SchedulingError(
    "FORBIDDEN",
    "Only the assigned tutor or staff can schedule this lesson.",
    403,
  );
}

interface LessonAccess {
  assignment: AssignmentFact;
  lesson: LessonRecord;
  isTutor: boolean;
  isStudent: boolean;
  isParent: boolean;
  isStaff: boolean;
}

async function requireLessonAccess(
  database: SchedulingDatabase,
  actor: SchedulingActor,
  lessonId: string,
): Promise<LessonAccess> {
  const lesson = await database.findLessonById(lessonId);
  if (!lesson) throw new SchedulingError("LESSON_NOT_FOUND", "Lesson was not found.", 404);
  const assignment = await requireAssignment(database, lesson.tutorStudentAssignmentId);

  const staff = isStaff(actor);
  const isTutor = actor.roles.includes("tutor") && actor.userId === assignment.tutorUserId;
  const isStudent = actor.roles.includes("student") && actor.userId === assignment.studentUserId;
  const isParent =
    actor.roles.includes("parent") &&
    (await database.isParentLinkedToStudent(actor.userId, assignment.studentProfileId));

  if (!staff && !isTutor && !isStudent && !isParent) {
    throw new SchedulingError("FORBIDDEN", "You do not have access to this lesson.", 403);
  }
  return { assignment, lesson, isTutor, isStudent, isParent, isStaff: staff };
}

async function seedParticipants(
  database: SchedulingDatabase,
  lessonId: string,
  assignment: AssignmentFact,
  additionalParticipantUserIds: readonly string[],
): Promise<void> {
  await database.addParticipant({
    id: ulid(),
    lessonId,
    userId: assignment.tutorUserId,
    role: "tutor",
  });
  await database.addParticipant({
    id: ulid(),
    lessonId,
    userId: assignment.studentUserId,
    role: "student",
  });
  for (const userId of new Set(additionalParticipantUserIds)) {
    if (userId === assignment.tutorUserId || userId === assignment.studentUserId) continue;
    await database.addParticipant({ id: ulid(), lessonId, userId, role: "student" });
  }
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

/**
 * Provisions `lesson` from the tutor's default Zoom settings (`/settings/zoom` in the web layer,
 * `packages/domain/tutors`), the same `ZoomLinkProvider` seam `setLessonZoomMeeting` uses for a
 * manual per-lesson entry. Audited under a distinct action (`scheduling.zoom.auto_assigned`) so it
 * stays separable from a tutor manually setting/overriding one lesson's link. Attributed to the
 * tutor even though no human actor triggered this particular call (new-series materialization runs
 * from the worker job with no request-scoped actor) — the tutor is who configured the default this
 * traces back to.
 */
async function autoAssignZoomFromDefaults(
  database: SchedulingDatabase,
  lesson: LessonRecord,
  tutorUserId: string,
  defaults: TutorZoomDefaults,
  provider: ZoomLinkProvider,
): Promise<void> {
  const details = await provider.provision({
    lessonId: lesson.id,
    scheduledStartAt: lesson.scheduledStartAt,
    scheduledEndAt: lesson.scheduledEndAt,
    topic: `Lesson ${lesson.id}`,
    manualEntry: { joinUrl: defaults.joinUrl, passcode: defaults.passcode },
  });
  await database.upsertZoomMeeting({
    lessonId: lesson.id,
    zoomMeetingId: details.zoomMeetingId,
    joinUrl: details.joinUrl,
    startUrl: details.startUrl,
    passcode: details.passcode,
  });
  await database.appendAudit({
    id: ulid(),
    actorUserId: tutorUserId,
    action: "scheduling.zoom.auto_assigned",
    resourceType: "zoom_meetings",
    resourceId: lesson.id,
    reason: "Zoom meeting auto-assigned from the tutor's default meeting settings.",
    newValue: { zoomMeetingId: details.zoomMeetingId },
  });
}

function minCalendarDate(a: string, b: string): string {
  return a < b ? a : b;
}

// ---------------------------------------------------------------------------
// Scheduling
// ---------------------------------------------------------------------------

/** The only public way to put a single, non-recurring lesson on the calendar. */
export async function scheduleOneTimeLesson(
  database: SchedulingDatabase,
  actor: SchedulingActor | null | undefined,
  input: CreateOneTimeLessonInput,
  zoomProvider: ZoomLinkProvider = createManualZoomLinkProvider(),
): Promise<LessonRecord> {
  requireAuthenticated(actor);
  const values = createOneTimeLessonInputSchema.parse(input);

  return database.transaction(async (transaction) => {
    const assignment = await requireAssignment(transaction, values.tutorStudentAssignmentId);
    await requireCanSchedule(actor, assignment);
    assertAssignmentActive(assignment);

    const lesson = await transaction.createLesson({
      id: ulid(),
      lessonSeriesId: null,
      tutorStudentAssignmentId: assignment.id,
      subjectId: values.subjectId,
      scheduledStartAt: values.scheduledStartAt,
      scheduledEndAt: new Date(values.scheduledStartAt.getTime() + values.durationMinutes * 60_000),
      timezoneAtBooking: values.timezoneAtBooking,
      isTrial: values.isTrial,
      status: "scheduled",
    });
    await seedParticipants(transaction, lesson.id, assignment, values.additionalParticipantUserIds);
    const zoomDefaults = await transaction.findTutorZoomDefaults(assignment.tutorProfileId);
    if (zoomDefaults) {
      await autoAssignZoomFromDefaults(
        transaction,
        lesson,
        assignment.tutorUserId,
        zoomDefaults,
        zoomProvider,
      );
    }
    await transaction.appendAudit({
      id: ulid(),
      actorUserId: actor.userId,
      action: "scheduling.lesson.scheduled",
      resourceType: "lessons",
      resourceId: lesson.id,
      reason: "One-time lesson scheduled.",
      newValue: {
        tutorStudentAssignmentId: assignment.id,
        scheduledStartAt: values.scheduledStartAt,
      },
    });
    return lesson;
  });
}

/**
 * Creates a recurring `lesson_series` row and materializes its first batch of `lessons` (up to
 * `materializeHorizonDays` ahead, or `endDate` if sooner). The worker job
 * (`apps/worker/src/jobs/scheduling/materialize-lessons.job.ts`) extends the horizon over time by
 * calling `materializeUpcomingLessons` again with the same series id.
 */
export async function createLessonSeries(
  database: SchedulingDatabase,
  actor: SchedulingActor | null | undefined,
  input: CreateLessonSeriesInput,
  zoomProvider: ZoomLinkProvider = createManualZoomLinkProvider(),
): Promise<{ series: LessonSeriesRecord; lessons: LessonRecord[] }> {
  requireAuthenticated(actor);
  const values = createLessonSeriesInputSchema.parse(input);

  return database.transaction(async (transaction) => {
    const assignment = await requireAssignment(transaction, values.tutorStudentAssignmentId);
    await requireCanSchedule(actor, assignment);
    assertAssignmentActive(assignment);

    const recurrenceRule = serializeRecurrencePattern({
      frequency: "weekly",
      interval: values.recurrence.interval,
      byDay: values.recurrence.byDay,
      hour: values.recurrence.hour,
      minute: values.recurrence.minute,
      timezone: values.recurrence.timezone,
    });

    const series = await transaction.createLessonSeries({
      id: ulid(),
      tutorStudentAssignmentId: assignment.id,
      subjectId: values.subjectId,
      recurrenceRule,
      startDate: values.startDate,
      endDate: values.endDate,
      status: "active",
    });

    const horizonEnd = formatCalendarDate(addDays(new Date(), values.materializeHorizonDays));
    const createdLessons = await materializeSeriesOccurrences(transaction, series, assignment, {
      windowEndDate: horizonEnd,
      durationMinutes: values.durationMinutes,
      additionalParticipantUserIds: values.additionalParticipantUserIds,
      zoomProvider,
    });

    await transaction.appendAudit({
      id: ulid(),
      actorUserId: actor.userId,
      action: "scheduling.lesson_series.created",
      resourceType: "lesson_series",
      resourceId: series.id,
      reason: "Recurring lesson series created.",
      newValue: {
        tutorStudentAssignmentId: assignment.id,
        recurrenceRule,
        occurrenceCount: createdLessons.length,
      },
    });

    return { series, lessons: createdLessons };
  });
}

async function materializeSeriesOccurrences(
  database: SchedulingDatabase,
  series: LessonSeriesRecord,
  assignment: AssignmentFact,
  options: {
    windowEndDate: string;
    durationMinutes: number;
    additionalParticipantUserIds: readonly string[];
    zoomProvider: ZoomLinkProvider;
  },
): Promise<LessonRecord[]> {
  const todayDate = formatCalendarDate(new Date());
  const windowStart = series.startDate > todayDate ? series.startDate : todayDate;
  const windowEnd = series.endDate
    ? minCalendarDate(series.endDate, options.windowEndDate)
    : options.windowEndDate;
  if (windowEnd < windowStart) return [];

  const pattern = parseRecurrencePattern(series.recurrenceRule);
  const occurrences = expandOccurrences(pattern, series.startDate, windowStart, windowEnd);
  const existingStarts = new Set(
    (await database.listLessonStartTimesForSeries(series.id)).map((date) => date.getTime()),
  );
  // Resolved once per materialization batch, not per lesson — the tutor's default can't change
  // mid-loop, and re-querying it per occurrence would be wasted round trips against the same row.
  const zoomDefaults = await database.findTutorZoomDefaults(assignment.tutorProfileId);

  const created: LessonRecord[] = [];
  for (const occurrence of occurrences) {
    if (existingStarts.has(occurrence.getTime())) continue;
    const lesson = await database.createLesson({
      id: ulid(),
      lessonSeriesId: series.id,
      tutorStudentAssignmentId: assignment.id,
      subjectId: series.subjectId,
      scheduledStartAt: occurrence,
      scheduledEndAt: new Date(occurrence.getTime() + options.durationMinutes * 60_000),
      timezoneAtBooking: pattern.timezone,
      isTrial: false,
      status: "scheduled",
    });
    await seedParticipants(database, lesson.id, assignment, options.additionalParticipantUserIds);
    if (zoomDefaults) {
      await autoAssignZoomFromDefaults(
        database,
        lesson,
        assignment.tutorUserId,
        zoomDefaults,
        options.zoomProvider,
      );
    }
    created.push(lesson);
  }
  return created;
}

/**
 * System-level operation (no actor — called only by the trusted worker job, never directly from
 * the web layer) that extends an active series' materialized `lessons` up to `horizonEndDate`.
 * Duration has no dedicated column on `lesson_series`, so it's inferred from the series' most
 * recently materialized lesson; a series with none yet (e.g. its `startDate` is further out than
 * every horizon applied so far) is skipped until one exists — see README, "Known limitations."
 */
export async function materializeUpcomingLessons(
  database: SchedulingDatabase,
  seriesId: string,
  horizonEndDate: string,
  zoomProvider: ZoomLinkProvider = createManualZoomLinkProvider(),
): Promise<LessonRecord[]> {
  return database.transaction(async (transaction) => {
    const series = await transaction.findLessonSeriesById(seriesId);
    if (!series || series.status !== "active") return [];

    const mostRecent = await transaction.findMostRecentLessonForSeries(seriesId);
    if (!mostRecent) return [];
    const durationMinutes = Math.round(
      (mostRecent.scheduledEndAt.getTime() - mostRecent.scheduledStartAt.getTime()) / 60_000,
    );

    const assignment = await requireAssignment(transaction, series.tutorStudentAssignmentId);
    return materializeSeriesOccurrences(transaction, series, assignment, {
      windowEndDate: horizonEndDate,
      durationMinutes,
      additionalParticipantUserIds: [],
      zoomProvider,
    });
  });
}

// ---------------------------------------------------------------------------
// Reschedule / cancel / delete / no-show
// ---------------------------------------------------------------------------

/**
 * Moves a scheduled lesson to a new time, always free of charge (spec §5.4: "reschedule
 * permitted" is the alternative to a chargeable late cancellation). The original lesson is kept
 * as a `"rescheduled"` row for history; a new `"scheduled"` lesson row carries the roster and Zoom
 * details forward. A parent/student may only do this with the same ≥8h notice a free cancellation
 * would need; tutor and staff can reschedule at any time (with a reason).
 */
export async function rescheduleLesson(
  database: SchedulingDatabase,
  actor: SchedulingActor | null | undefined,
  lessonId: string,
  input: RescheduleLessonInput,
  policy: CancellationPolicyConfig = DEFAULT_CANCELLATION_POLICY,
): Promise<{ previous: LessonRecord; next: LessonRecord }> {
  requireAuthenticated(actor);
  const values = rescheduleLessonInputSchema.parse(input);

  return database.transaction(async (transaction) => {
    const access = await requireLessonAccess(transaction, actor, lessonId);
    if (access.lesson.status !== "scheduled") {
      throw new SchedulingError(
        "LESSON_NOT_SCHEDULED",
        "Only a scheduled lesson can be rescheduled.",
        409,
      );
    }
    const notice = hoursBeforeLesson(access.lesson.scheduledStartAt, new Date());
    const freeToReschedule = access.isStaff || access.isTutor || notice >= policy.freeWindowHours;
    if (!freeToReschedule) {
      throw new SchedulingError(
        "FORBIDDEN",
        "Rescheduling inside the free-cancellation notice window requires the tutor or staff.",
        403,
      );
    }

    const previous = await transaction.updateLessonStatus(access.lesson.id, "rescheduled");
    const next = await transaction.createLesson({
      id: ulid(),
      lessonSeriesId: access.lesson.lessonSeriesId,
      tutorStudentAssignmentId: access.lesson.tutorStudentAssignmentId,
      subjectId: access.lesson.subjectId,
      scheduledStartAt: values.newScheduledStartAt,
      scheduledEndAt: new Date(
        values.newScheduledStartAt.getTime() + values.durationMinutes * 60_000,
      ),
      timezoneAtBooking: access.lesson.timezoneAtBooking,
      isTrial: access.lesson.isTrial,
      status: "scheduled",
    });

    const participants = await transaction.listParticipants(access.lesson.id);
    for (const participant of participants) {
      await transaction.addParticipant({
        id: ulid(),
        lessonId: next.id,
        userId: participant.userId,
        role: participant.role,
      });
    }
    const existingZoom = await transaction.findZoomMeetingByLessonId(access.lesson.id);
    if (existingZoom) {
      await transaction.upsertZoomMeeting({
        lessonId: next.id,
        zoomMeetingId: existingZoom.zoomMeetingId,
        joinUrl: existingZoom.joinUrl,
        startUrl: existingZoom.startUrl,
        passcode: existingZoom.passcode,
      });
    }

    await transaction.appendAudit({
      id: ulid(),
      actorUserId: actor.userId,
      action: "scheduling.lesson.rescheduled",
      resourceType: "lessons",
      resourceId: access.lesson.id,
      reason: values.reason,
      previousValue: { scheduledStartAt: access.lesson.scheduledStartAt },
      newValue: { newLessonId: next.id, scheduledStartAt: values.newScheduledStartAt },
    });
    return { previous, next };
  });
}

/** Categories a given accessor is allowed to attribute a cancellation to — prevents e.g. a parent claiming `tutor_request` to dodge a charge. */
function allowedCategoriesFor(access: LessonAccess): readonly CancellationCategory[] {
  if (access.isStaff) {
    return ["parent_request", "tutor_request", "admin_action", "technical_issue", "other"];
  }
  if (access.isTutor) return ["tutor_request", "technical_issue"];
  return ["parent_request", "technical_issue"]; // parent or student
}

export async function cancelLesson(
  database: SchedulingDatabase,
  actor: SchedulingActor | null | undefined,
  lessonId: string,
  input: CancelLessonInput,
  policy: CancellationPolicyConfig = DEFAULT_CANCELLATION_POLICY,
): Promise<{ lesson: LessonRecord; cancellation: CancellationRecord }> {
  requireAuthenticated(actor);
  const values = cancelLessonInputSchema.parse(input);

  return database.transaction(async (transaction) => {
    const access = await requireLessonAccess(transaction, actor, lessonId);
    if (access.lesson.status !== "scheduled") {
      throw new SchedulingError(
        "LESSON_ALREADY_RESOLVED",
        "This lesson is no longer scheduled.",
        409,
      );
    }
    if (!allowedCategoriesFor(access).includes(values.category)) {
      throw new SchedulingError(
        "FORBIDDEN",
        "This cancellation category is not available to your role.",
        403,
      );
    }

    const now = new Date();
    const notice = hoursBeforeLesson(access.lesson.scheduledStartAt, now);
    const initiatedBy = initiatorFromCategory(values.category, null);
    const studentParticipantCount = (await transaction.listParticipants(access.lesson.id)).filter(
      (participant) => participant.role === "student",
    ).length;
    const lessonKind = lessonKindFrom({
      isTrial: access.lesson.isTrial,
      studentParticipantCount,
    });
    const charge = computeCancellationCharge(
      { category: values.category, initiatedBy, lessonKind, hoursBeforeLesson: notice },
      policy,
    );

    const cancellation = await transaction.createCancellation({
      id: ulid(),
      lessonId: access.lesson.id,
      canceledByUserId: actor.userId,
      reason: values.reason,
      category: values.category,
      chargeApplied: charge.chargeable,
    });
    const lesson = await transaction.updateLessonStatus(access.lesson.id, "canceled");
    await transaction.appendAudit({
      id: ulid(),
      actorUserId: actor.userId,
      action: "scheduling.lesson.canceled",
      resourceType: "lessons",
      resourceId: access.lesson.id,
      reason: values.reason,
      previousValue: { status: access.lesson.status },
      newValue: {
        category: values.category,
        chargeApplied: charge.chargeable,
        chargePercentage: charge.percentage,
      },
    });
    return { lesson, cancellation };
  });
}

/**
 * Translates a raw FK-violation from `transaction.deleteLesson()` into a typed, user-facing
 * error. A `"scheduled"` lesson is never expected to have a `lesson_charges`/`lesson_feedback`/
 * `assignments`/`tutor_notes` row pointing at it (those all attach after a lesson resolves), but
 * those four tables reference `lessons` with `onDelete: "restrict"` (see
 * packages/db/src/schema/{finance,academic,assignments}.ts) — this is the defensive fallback for
 * that edge case, not the primary guard (the primary guard is the `status !== "scheduled"` check).
 * Postgres's SQLSTATE for a foreign-key violation (`23503`) is driver-independent; postgres.js
 * attaches it as `.code` on the thrown error.
 */
function mapDeleteConflict(error: unknown): never {
  if (error && typeof error === "object" && "code" in error && error.code === "23503") {
    throw new SchedulingError(
      "LESSON_HAS_DEPENDENT_RECORDS",
      "This class has related records (homework, feedback, or a charge) and can't be deleted. Cancel it instead.",
      409,
    );
  }
  throw error;
}

/**
 * Hard-removes a one-time, still-`"scheduled"` lesson — a real delete, not a status change, so it
 * disappears from every viewer's schedule (tutor, student, parent, staff) since they all read the
 * same `lessons` row. Deliberately narrower than `cancelLesson`:
 *
 * - Only the assignment's own tutor or staff (never a parent/student — matches `recordNoShow`).
 * - Only a `"scheduled"` lesson (a completed/canceled/no-show/rescheduled one already has
 *   dependent history — attendance, a charge, a cancellation record — that a hard delete would
 *   either orphan or destroy; use `cancelLesson` for those).
 * - Never a lesson still linked to an *active* series (`lessonSeriesId !== null`): the daily
 *   `scheduling.materialize-lessons` worker job dedupes purely by start time
 *   (`listLessonStartTimesForSeries`), so deleting one occurrence's row would make that start time
 *   re-appear as "unmaterialized" and the job would silently recreate it tomorrow. Cancel the
 *   occurrence instead (its row survives with `status: "canceled"`, which still dedupes), or call
 *   `deleteLessonSeries` to remove the whole recurring booking.
 */
export async function deleteLesson(
  database: SchedulingDatabase,
  actor: SchedulingActor | null | undefined,
  lessonId: string,
  input: DeleteLessonInput = {},
): Promise<{ lesson: LessonRecord }> {
  requireAuthenticated(actor);
  const values = deleteLessonInputSchema.parse(input);

  return database.transaction(async (transaction) => {
    const access = await requireLessonAccess(transaction, actor, lessonId);
    if (!access.isTutor && !access.isStaff) {
      throw new SchedulingError(
        "FORBIDDEN",
        "Only the assigned tutor or staff can delete this class.",
        403,
      );
    }
    if (access.lesson.status !== "scheduled") {
      throw new SchedulingError(
        "LESSON_ALREADY_RESOLVED",
        "Only a scheduled class can be deleted. Completed, canceled, or no-show classes keep their history.",
        409,
      );
    }
    if (access.lesson.lessonSeriesId !== null) {
      throw new SchedulingError(
        "LESSON_PART_OF_SERIES",
        "This class is part of a recurring series. Cancel just this occurrence, or delete the entire series.",
        409,
      );
    }

    await transaction.appendAudit({
      id: ulid(),
      actorUserId: actor.userId,
      action: "scheduling.lesson.deleted",
      resourceType: "lessons",
      resourceId: access.lesson.id,
      reason: values.reason ?? "Deleted by tutor.",
      previousValue: {
        status: access.lesson.status,
        scheduledStartAt: access.lesson.scheduledStartAt,
        tutorStudentAssignmentId: access.lesson.tutorStudentAssignmentId,
      },
    });

    try {
      await transaction.deleteLesson(access.lesson.id);
    } catch (error: unknown) {
      mapDeleteConflict(error);
    }

    return { lesson: access.lesson };
  });
}

/**
 * Ends a recurring series (halting further materialization — `materializeUpcomingLessons` skips
 * any series whose `status !== "active"`) and hard-deletes every still-`"scheduled"`, still-*in
 * the future* occurrence already materialized for it. Past occurrences are left untouched even if
 * they're still `"scheduled"` (nothing auto-transitions a lesson the tutor never marked
 * complete/no-show, and it may carry real attendance history) — same rationale as `deleteLesson`.
 */
export async function deleteLessonSeries(
  database: SchedulingDatabase,
  actor: SchedulingActor | null | undefined,
  seriesId: string,
  input: DeleteLessonSeriesInput = {},
): Promise<{ series: LessonSeriesRecord; deletedLessonIds: string[] }> {
  requireAuthenticated(actor);
  const values = deleteLessonSeriesInputSchema.parse(input);

  return database.transaction(async (transaction) => {
    const series = await transaction.findLessonSeriesById(seriesId);
    if (!series) {
      throw new SchedulingError("LESSON_SERIES_NOT_FOUND", "Lesson series was not found.", 404);
    }
    const assignment = await requireAssignment(transaction, series.tutorStudentAssignmentId);
    if (
      !isStaff(actor) &&
      !(actor.roles.includes("tutor") && actor.userId === assignment.tutorUserId)
    ) {
      throw new SchedulingError(
        "FORBIDDEN",
        "Only the assigned tutor or staff can delete this series.",
        403,
      );
    }

    const seriesLessons = await transaction.listLessonsForSeries(series.id);
    const now = new Date();
    // `status === "scheduled"` alone isn't enough: a past occurrence the tutor never marked
    // complete/no-show still sits at "scheduled" forever (nothing transitions it automatically),
    // and it may carry real attendance/feedback/charge history. Only a *future* scheduled
    // occurrence is safe to hard-delete — same rule `deleteLesson` applies to a standalone lesson.
    const toDelete = seriesLessons.filter(
      (lesson) => lesson.status === "scheduled" && lesson.scheduledStartAt > now,
    );

    await transaction.updateLessonSeriesStatus(series.id, "cancelled");
    await transaction.appendAudit({
      id: ulid(),
      actorUserId: actor.userId,
      action: "scheduling.lesson_series.deleted",
      resourceType: "lesson_series",
      resourceId: series.id,
      reason: values.reason ?? "Deleted by tutor.",
      previousValue: { status: series.status, occurrenceCount: seriesLessons.length },
      newValue: { deletedLessonCount: toDelete.length },
    });

    for (const lesson of toDelete) {
      try {
        await transaction.deleteLesson(lesson.id);
      } catch (error: unknown) {
        mapDeleteConflict(error);
      }
    }

    const updated = await transaction.findLessonSeriesById(series.id);
    return {
      series: updated ?? { ...series, status: "cancelled" },
      deletedLessonIds: toDelete.map((lesson) => lesson.id),
    };
  });
}

/** Only the assigned tutor or staff record a no-show — spec §5.2, "Tutor marks attendance and completion." */
export async function recordNoShow(
  database: SchedulingDatabase,
  actor: SchedulingActor | null | undefined,
  lessonId: string,
  input: RecordNoShowInput,
  policy: CancellationPolicyConfig = DEFAULT_CANCELLATION_POLICY,
): Promise<{ lesson: LessonRecord; cancellation: CancellationRecord }> {
  requireAuthenticated(actor);
  const values = recordNoShowInputSchema.parse(input);

  return database.transaction(async (transaction) => {
    const access = await requireLessonAccess(transaction, actor, lessonId);
    if (!access.isTutor && !access.isStaff) {
      throw new SchedulingError(
        "FORBIDDEN",
        "Only the assigned tutor or staff can record a no-show.",
        403,
      );
    }
    if (access.lesson.status !== "scheduled") {
      throw new SchedulingError(
        "LESSON_ALREADY_RESOLVED",
        "This lesson is no longer scheduled.",
        409,
      );
    }

    const notice = hoursBeforeLesson(access.lesson.scheduledStartAt, new Date());
    const initiatedBy = initiatorFromCategory("no_show", values.party);
    const studentParticipantCount = (await transaction.listParticipants(access.lesson.id)).filter(
      (participant) => participant.role === "student",
    ).length;
    const lessonKind = lessonKindFrom({
      isTrial: access.lesson.isTrial,
      studentParticipantCount,
    });
    const charge = computeCancellationCharge(
      { category: "no_show", initiatedBy, lessonKind, hoursBeforeLesson: notice },
      policy,
    );

    const cancellation = await transaction.createCancellation({
      id: ulid(),
      lessonId: access.lesson.id,
      canceledByUserId: actor.userId,
      reason: values.reason,
      category: "no_show",
      chargeApplied: charge.chargeable,
    });
    const lesson = await transaction.updateLessonStatus(
      access.lesson.id,
      values.party === "tutor" ? "no_show_tutor" : "no_show_student",
    );
    await transaction.appendAudit({
      id: ulid(),
      actorUserId: actor.userId,
      action: "scheduling.lesson.no_show_recorded",
      resourceType: "lessons",
      resourceId: access.lesson.id,
      reason: values.reason,
      newValue: {
        party: values.party,
        chargeApplied: charge.chargeable,
        chargePercentage: charge.percentage,
      },
    });
    return { lesson, cancellation };
  });
}

// ---------------------------------------------------------------------------
// Attendance / completion / Zoom
// ---------------------------------------------------------------------------

export async function recordAttendance(
  database: SchedulingDatabase,
  actor: SchedulingActor | null | undefined,
  lessonId: string,
  input: RecordAttendanceInput,
): Promise<AttendanceRecord> {
  requireAuthenticated(actor);
  const values = recordAttendanceInputSchema.parse(input);

  return database.transaction(async (transaction) => {
    const access = await requireLessonAccess(transaction, actor, lessonId);
    if (!access.isTutor && !access.isStaff) {
      throw new SchedulingError(
        "FORBIDDEN",
        "Only the assigned tutor or staff can record attendance.",
        403,
      );
    }
    const attendance = await transaction.upsertAttendance({
      id: ulid(),
      lessonId: access.lesson.id,
      studentProfileId: values.studentProfileId,
      status: values.status,
      recordedByUserId: actor.userId,
      notes: values.notes,
    });
    await transaction.appendAudit({
      id: ulid(),
      actorUserId: actor.userId,
      action: "scheduling.attendance.recorded",
      resourceType: "attendance",
      resourceId: attendance.id,
      reason: "Tutor recorded attendance.",
      newValue: { studentProfileId: values.studentProfileId, status: values.status },
    });
    return attendance;
  });
}

export async function completeLesson(
  database: SchedulingDatabase,
  actor: SchedulingActor | null | undefined,
  lessonId: string,
): Promise<LessonRecord> {
  requireAuthenticated(actor);
  return database.transaction(async (transaction) => {
    const access = await requireLessonAccess(transaction, actor, lessonId);
    if (!access.isTutor && !access.isStaff) {
      throw new SchedulingError(
        "FORBIDDEN",
        "Only the assigned tutor or staff can complete this lesson.",
        403,
      );
    }
    if (access.lesson.status !== "scheduled") {
      throw new SchedulingError(
        "LESSON_ALREADY_RESOLVED",
        "This lesson is no longer scheduled.",
        409,
      );
    }
    const lesson = await transaction.updateLessonStatus(access.lesson.id, "completed");
    await transaction.appendAudit({
      id: ulid(),
      actorUserId: actor.userId,
      action: "scheduling.lesson.completed",
      resourceType: "lessons",
      resourceId: access.lesson.id,
      reason: "Tutor marked the lesson complete.",
      previousValue: { status: access.lesson.status },
      newValue: { status: "completed" },
    });
    return lesson;
  });
}

export async function setLessonZoomMeeting(
  database: SchedulingDatabase,
  actor: SchedulingActor | null | undefined,
  lessonId: string,
  input: SetZoomMeetingInput,
  provider: ZoomLinkProvider = createManualZoomLinkProvider(),
): Promise<ZoomMeetingRecord> {
  requireAuthenticated(actor);
  const values = setZoomMeetingInputSchema.parse(input);

  return database.transaction(async (transaction) => {
    const access = await requireLessonAccess(transaction, actor, lessonId);
    if (!access.isTutor && !access.isStaff) {
      throw new SchedulingError(
        "FORBIDDEN",
        "Only the assigned tutor or staff can set the Zoom link.",
        403,
      );
    }
    const details = await provider.provision({
      lessonId: access.lesson.id,
      scheduledStartAt: access.lesson.scheduledStartAt,
      scheduledEndAt: access.lesson.scheduledEndAt,
      topic: `Lesson ${access.lesson.id}`,
      manualEntry: values,
    });
    const zoom = await transaction.upsertZoomMeeting({
      lessonId: access.lesson.id,
      zoomMeetingId: details.zoomMeetingId,
      joinUrl: details.joinUrl,
      startUrl: details.startUrl,
      passcode: details.passcode,
    });
    await transaction.appendAudit({
      id: ulid(),
      actorUserId: actor.userId,
      action: "scheduling.zoom.set",
      resourceType: "zoom_meetings",
      resourceId: access.lesson.id,
      reason: "Zoom meeting details updated.",
      newValue: { zoomMeetingId: details.zoomMeetingId },
    });
    return zoom;
  });
}

/**
 * Called right after a tutor saves their default Zoom settings (`updateTutorZoomDefaults` in
 * `packages/domain/tutors/services.ts`, from the `/api/tutors/me/zoom` route). Series lessons are
 * materialized ahead of time (`materializeSeriesOccurrences` above), so most of what's already on a
 * tutor's calendar was created *before* they ever set a default — without this, "automatically
 * assigned to each class" would only be true for classes booked after this moment. Scoped to
 * `"scheduled"` lessons with no Zoom row yet: a lesson someone already gave its own link via
 * `setLessonZoomMeeting` (a manual per-lesson override) is left alone. `180` mirrors
 * `createLessonSeriesInputSchema`'s `materializeHorizonDays` max — nothing is ever materialized
 * further out than that, so nothing meaningful is missed past it.
 */
export async function applyTutorZoomDefaultsToUpcomingLessons(
  database: SchedulingDatabase,
  tutorProfileId: string,
  tutorUserId: string,
  defaults: TutorZoomDefaults,
  provider: ZoomLinkProvider = createManualZoomLinkProvider(),
): Promise<number> {
  return database.transaction(async (transaction) => {
    const lessons = await transaction.listLessonsForScope(
      { kind: "tutor", tutorProfileId },
      { from: new Date(), to: addDays(new Date(), 180), limit: 500 },
    );
    let assignedCount = 0;
    for (const lesson of lessons) {
      if (lesson.status !== "scheduled") continue;
      if (await transaction.findZoomMeetingByLessonId(lesson.id)) continue;
      await autoAssignZoomFromDefaults(transaction, lesson, tutorUserId, defaults, provider);
      assignedCount += 1;
    }
    return assignedCount;
  });
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function getLessonDetail(
  database: SchedulingDatabase,
  actor: SchedulingActor | null | undefined,
  lessonId: string,
): Promise<LessonDetail> {
  requireAuthenticated(actor);
  const access = await requireLessonAccess(database, actor, lessonId);
  const [participants, zoom, cancellation, attendance] = await Promise.all([
    database.listParticipants(access.lesson.id),
    database.findZoomMeetingByLessonId(access.lesson.id),
    database.findCancellationByLessonId(access.lesson.id),
    database.listAttendanceForLesson(access.lesson.id),
  ]);
  return { lesson: access.lesson, participants, zoom, cancellation, attendance };
}

async function resolveScope(
  database: SchedulingDatabase,
  actor: SchedulingActor,
): Promise<LessonListScope> {
  if (isStaff(actor)) return { kind: "staff" };
  if (actor.roles.includes("tutor")) {
    const tutorProfileId = await database.resolveTutorProfileIdForUser(actor.userId);
    if (tutorProfileId) return { kind: "tutor", tutorProfileId };
  }
  if (actor.roles.includes("student")) {
    const studentProfileId = await database.resolveStudentProfileIdForUser(actor.userId);
    if (studentProfileId) return { kind: "student", studentProfileId };
  }
  if (actor.roles.includes("parent")) {
    const parentProfileId = await database.resolveParentProfileIdForUser(actor.userId);
    if (parentProfileId) return { kind: "parent", parentProfileId };
  }
  throw new SchedulingError("FORBIDDEN", "No schedulable relationship found for this actor.", 403);
}

export async function listLessonsForActor(
  database: SchedulingDatabase,
  actor: SchedulingActor | null | undefined,
  range: { from: Date; to: Date; limit?: number },
): Promise<LessonRecord[]> {
  requireAuthenticated(actor);
  const scope = await resolveScope(database, actor);
  return database.listLessonsForScope(scope, {
    from: range.from,
    to: range.to,
    limit: range.limit ?? 100,
  });
}

/** Resolves to the same `tutorProfileId | null` (`null` = staff, sees everyone's) `requireCanSchedule` implicitly grants access under — mirrors `resolveScope` above but narrowed to the two roles that can actually schedule a lesson. */
async function resolveSchedulingTutorScope(
  database: SchedulingDatabase,
  actor: SchedulingActor,
): Promise<string | null> {
  if (isStaff(actor)) return null;
  if (actor.roles.includes("tutor")) {
    const tutorProfileId = await database.resolveTutorProfileIdForUser(actor.userId);
    if (tutorProfileId) return tutorProfileId;
  }
  throw new SchedulingError("FORBIDDEN", "Only tutors and staff can schedule lessons.", 403);
}

/** Active assignments the actor may schedule a lesson against — the new-lesson form's student picker. */
export async function listSchedulableAssignments(
  database: SchedulingDatabase,
  actor: SchedulingActor | null | undefined,
): Promise<SchedulableAssignmentOption[]> {
  requireAuthenticated(actor);
  const tutorProfileId = await resolveSchedulingTutorScope(database, actor);
  return database.listSchedulableAssignments(tutorProfileId);
}

/** Subjects the actor may pick when scheduling a lesson — the new-lesson form's subject picker. */
export async function listSchedulableSubjects(
  database: SchedulingDatabase,
  actor: SchedulingActor | null | undefined,
): Promise<SubjectOption[]> {
  requireAuthenticated(actor);
  const tutorProfileId = await resolveSchedulingTutorScope(database, actor);
  return database.listSchedulableSubjects(tutorProfileId);
}
