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
  SchedulingActor,
  SchedulingDatabase,
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
  recordAttendanceInputSchema,
  recordNoShowInputSchema,
  rescheduleLessonInputSchema,
  setZoomMeetingInputSchema,
  type CancelLessonInput,
  type CreateLessonSeriesInput,
  type CreateOneTimeLessonInput,
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
    });
  });
}

// ---------------------------------------------------------------------------
// Reschedule / cancel / no-show
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
