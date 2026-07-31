import type { CancellationCategory } from "./cancellation-policy";

/**
 * Mirrors `@app/auth`'s `Role` union exactly (including `"finance"`, which this module grants no
 * access to) so `Actor` from `@app/auth` is structurally assignable to `SchedulingActor` without a
 * conversion step — the same trick `packages/domain/families/models.ts`'s `FamilyRole` uses, for
 * the same reason (this package cannot depend on `@app/auth` — see runtime.ts).
 */
export type SchedulingRole =
  "parent" | "student" | "tutor" | "finance" | "administrator" | "super_administrator";

export interface SchedulingActor {
  userId: string;
  roles: readonly SchedulingRole[];
}

export type LessonSeriesStatus = "active" | "ended" | "cancelled";
export type LessonStatus =
  "scheduled" | "completed" | "canceled" | "no_show_student" | "no_show_tutor" | "rescheduled";
export type LessonParticipantRole = "tutor" | "student" | "observer";
export type AttendanceStatus = "present" | "absent" | "late" | "excused";
export type AssignmentStatus = "proposed" | "active" | "ended" | "rejected";

export interface AssignmentFact {
  id: string;
  tutorProfileId: string;
  tutorUserId: string;
  studentProfileId: string;
  studentUserId: string;
  subjectId: string | null;
  status: AssignmentStatus;
  endAt: Date | null;
}

export interface LessonSeriesRecord {
  id: string;
  tutorStudentAssignmentId: string;
  subjectId: string;
  /** Packed pattern string — see recurrence.ts `serializeRecurrencePattern`/`parseRecurrencePattern`. */
  recurrenceRule: string;
  startDate: string;
  endDate: string | null;
  status: LessonSeriesStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface LessonRecord {
  id: string;
  lessonSeriesId: string | null;
  tutorStudentAssignmentId: string;
  subjectId: string;
  scheduledStartAt: Date;
  scheduledEndAt: Date;
  status: LessonStatus;
  timezoneAtBooking: string;
  isTrial: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface LessonParticipantRecord {
  id: string;
  lessonId: string;
  userId: string;
  role: LessonParticipantRole;
  joinedAt: Date | null;
  leftAt: Date | null;
}

export interface ZoomMeetingRecord {
  id: string;
  lessonId: string;
  zoomMeetingId: string;
  joinUrl: string;
  startUrl: string | null;
  passcode: string | null;
}

export interface CancellationRecord {
  id: string;
  lessonId: string;
  canceledByUserId: string;
  reason: string | null;
  category: CancellationCategory;
  canceledAt: Date;
  chargeApplied: boolean;
}

export interface AttendanceRecord {
  id: string;
  lessonId: string;
  studentProfileId: string;
  status: AttendanceStatus;
  joinedAt: Date | null;
  leftAt: Date | null;
  recordedByUserId: string;
  notes: string | null;
}

export interface LessonDetail {
  lesson: LessonRecord;
  participants: LessonParticipantRecord[];
  zoom: ZoomMeetingRecord | null;
  cancellation: CancellationRecord | null;
  attendance: AttendanceRecord[];
}

export interface AuditValues {
  id: string;
  actorUserId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  reason: string;
  previousValue?: unknown;
  newValue?: unknown;
}

export interface NewLessonSeriesValues {
  id: string;
  tutorStudentAssignmentId: string;
  subjectId: string;
  recurrenceRule: string;
  startDate: string;
  endDate: string | null;
  status: "active";
}

export interface NewLessonValues {
  id: string;
  lessonSeriesId: string | null;
  tutorStudentAssignmentId: string;
  subjectId: string;
  scheduledStartAt: Date;
  scheduledEndAt: Date;
  timezoneAtBooking: string;
  isTrial: boolean;
  status: "scheduled";
}

export interface NewLessonParticipantValues {
  id: string;
  lessonId: string;
  userId: string;
  role: LessonParticipantRole;
}

export interface NewZoomMeetingValues {
  lessonId: string;
  zoomMeetingId: string;
  joinUrl: string;
  startUrl: string | null;
  passcode: string | null;
}

export interface NewCancellationValues {
  id: string;
  lessonId: string;
  canceledByUserId: string;
  reason: string | null;
  category: CancellationCategory;
  chargeApplied: boolean;
}

export interface NewAttendanceValues {
  id: string;
  lessonId: string;
  studentProfileId: string;
  status: AttendanceStatus;
  recordedByUserId: string;
  notes: string | null;
}

/** A scope-narrowed lesson listing request; the drizzle implementation joins from whichever party the actor is. */
export type LessonListScope =
  | { kind: "tutor"; tutorProfileId: string }
  | { kind: "student"; studentProfileId: string }
  | { kind: "parent"; parentProfileId: string }
  | { kind: "staff" };

export interface LessonListRange {
  from: Date;
  to: Date;
  limit: number;
}

/**
 * The port every scheduling service depends on. `drizzle-database.ts` implements it against
 * `@app/db`; tests use a plain in-memory fake — see apps/web/tests/scheduling/support. Mirrors
 * the shape of `packages/domain/families/models.ts`'s `FamilyDatabase` deliberately, for the same
 * reason: services stay pure/testable without a live Postgres connection.
 */
export interface SchedulingDatabase {
  transaction<T>(operation: (database: SchedulingDatabase) => Promise<T>): Promise<T>;

  findAssignmentById(assignmentId: string): Promise<AssignmentFact | null>;
  resolveTutorProfileIdForUser(userId: string): Promise<string | null>;
  resolveStudentProfileIdForUser(userId: string): Promise<string | null>;
  resolveParentProfileIdForUser(userId: string): Promise<string | null>;
  isParentLinkedToStudent(parentUserId: string, studentProfileId: string): Promise<boolean>;

  createLessonSeries(values: NewLessonSeriesValues): Promise<LessonSeriesRecord>;
  findLessonSeriesById(id: string): Promise<LessonSeriesRecord | null>;
  updateLessonSeriesStatus(id: string, status: LessonSeriesStatus): Promise<void>;
  /** Existing occurrence start times for a series, used to dedupe when extending the materialization horizon. */
  listLessonStartTimesForSeries(seriesId: string): Promise<Date[]>;
  /** Used by the materialization job to infer a series' lesson duration, which has no dedicated column — see services.ts `materializeUpcomingLessons`. */
  findMostRecentLessonForSeries(seriesId: string): Promise<LessonRecord | null>;

  createLesson(values: NewLessonValues): Promise<LessonRecord>;
  findLessonById(id: string): Promise<LessonRecord | null>;
  updateLessonStatus(id: string, status: LessonStatus): Promise<LessonRecord>;
  listLessonsForScope(scope: LessonListScope, range: LessonListRange): Promise<LessonRecord[]>;

  addParticipant(values: NewLessonParticipantValues): Promise<LessonParticipantRecord>;
  listParticipants(lessonId: string): Promise<LessonParticipantRecord[]>;

  upsertZoomMeeting(values: NewZoomMeetingValues): Promise<ZoomMeetingRecord>;
  findZoomMeetingByLessonId(lessonId: string): Promise<ZoomMeetingRecord | null>;

  createCancellation(values: NewCancellationValues): Promise<CancellationRecord>;
  findCancellationByLessonId(lessonId: string): Promise<CancellationRecord | null>;

  upsertAttendance(values: NewAttendanceValues): Promise<AttendanceRecord>;
  listAttendanceForLesson(lessonId: string): Promise<AttendanceRecord[]>;

  appendAudit(values: AuditValues): Promise<void>;
}
