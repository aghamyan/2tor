import { boolean, date, integer, pgEnum, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";
import { ianaTimezone, timestamps, ulidFk, ulidPk, utcTimestamp } from "./_common";
import { users } from "./identity";
import { studentProfiles } from "./families";
import { tutorProfiles } from "./tutors";
import { tutorStudentAssignments } from "./matching";
import { subjects } from "./academic";

/**
 * Scheduling domain: recurring lesson series, individual lessons, attendance, cancellations, and
 * the Zoom link record for each lesson. Zoom itself hosts the call (spec §14.2) — this table only
 * stores the join metadata.
 */

export const lessonSeriesStatusEnum = pgEnum("lesson_series_status", [
  "active",
  "ended",
  "cancelled",
]);
export const lessonStatusEnum = pgEnum("lesson_status", [
  "scheduled",
  "completed",
  "canceled",
  "no_show_student",
  "no_show_tutor",
  "rescheduled",
]);
export const lessonParticipantRoleEnum = pgEnum("lesson_participant_role", [
  "tutor",
  "student",
  "observer",
]);
export const availabilityExceptionTypeEnum = pgEnum("availability_exception_type", [
  "unavailable",
  "extra_availability",
]);
export const cancellationCategoryEnum = pgEnum("cancellation_category", [
  "parent_request",
  "tutor_request",
  "admin_action",
  "no_show",
  "technical_issue",
  "other",
]);
export const attendanceStatusEnum = pgEnum("attendance_status", [
  "present",
  "absent",
  "late",
  "excused",
]);

export const lessonSeries = pgTable("lesson_series", {
  id: ulidPk(),
  tutorStudentAssignmentId: ulidFk("tutor_student_assignment_id")
    .notNull()
    .references(() => tutorStudentAssignments.id, { onDelete: "restrict" }),
  subjectId: ulidFk("subject_id")
    .notNull()
    .references(() => subjects.id, { onDelete: "restrict" }),
  /** RFC 5545 RRULE string, expanded into individual `lessons` rows by the scheduling job. */
  recurrenceRule: text("recurrence_rule"),
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  status: lessonSeriesStatusEnum("status").notNull().default("active"),
  ...timestamps,
});

export const lessons = pgTable("lessons", {
  id: ulidPk(),
  lessonSeriesId: ulidFk("lesson_series_id").references(() => lessonSeries.id, {
    onDelete: "restrict",
  }),
  tutorStudentAssignmentId: ulidFk("tutor_student_assignment_id")
    .notNull()
    .references(() => tutorStudentAssignments.id, { onDelete: "restrict" }),
  subjectId: ulidFk("subject_id")
    .notNull()
    .references(() => subjects.id, { onDelete: "restrict" }),
  scheduledStartAt: utcTimestamp("scheduled_start_at").notNull(),
  scheduledEndAt: utcTimestamp("scheduled_end_at").notNull(),
  status: lessonStatusEnum("status").notNull().default("scheduled"),
  /** Snapshot of the booking party's time zone at booking time, for honest historical display. */
  timezoneAtBooking: ianaTimezone("timezone_at_booking").notNull(),
  isTrial: boolean("is_trial").notNull().default(false),
  ...timestamps,
});

/** Roster of who is expected at a lesson (supports group lessons). Actual join/leave is `attendance`. */
export const lessonParticipants = pgTable(
  "lesson_participants",
  {
    id: ulidPk(),
    lessonId: ulidFk("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    userId: ulidFk("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    role: lessonParticipantRoleEnum("role").notNull(),
    joinedAt: utcTimestamp("joined_at"),
    leftAt: utcTimestamp("left_at"),
    createdAt: timestamps.createdAt,
  },
  (table) => [uniqueIndex("lesson_participants_unique").on(table.lessonId, table.userId)],
);

export const availabilityExceptions = pgTable("availability_exceptions", {
  id: ulidPk(),
  tutorProfileId: ulidFk("tutor_profile_id")
    .notNull()
    .references(() => tutorProfiles.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  startMinute: integer("start_minute"),
  endMinute: integer("end_minute"),
  type: availabilityExceptionTypeEnum("type").notNull(),
  reason: text("reason"),
  createdAt: timestamps.createdAt,
});

export const cancellations = pgTable("cancellations", {
  id: ulidPk(),
  lessonId: ulidFk("lesson_id")
    .notNull()
    .unique()
    .references(() => lessons.id, { onDelete: "cascade" }),
  canceledByUserId: ulidFk("canceled_by_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  reason: text("reason"),
  category: cancellationCategoryEnum("category").notNull(),
  canceledAt: utcTimestamp("canceled_at").notNull().defaultNow(),
  chargeApplied: boolean("charge_applied").notNull().default(false),
  createdAt: timestamps.createdAt,
});

export const attendance = pgTable(
  "attendance",
  {
    id: ulidPk(),
    lessonId: ulidFk("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    studentProfileId: ulidFk("student_profile_id")
      .notNull()
      .references(() => studentProfiles.id, { onDelete: "restrict" }),
    status: attendanceStatusEnum("status").notNull(),
    joinedAt: utcTimestamp("joined_at"),
    leftAt: utcTimestamp("left_at"),
    recordedByUserId: ulidFk("recorded_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [uniqueIndex("attendance_unique").on(table.lessonId, table.studentProfileId)],
);

export const zoomMeetings = pgTable("zoom_meetings", {
  id: ulidPk(),
  lessonId: ulidFk("lesson_id")
    .notNull()
    .unique()
    .references(() => lessons.id, { onDelete: "cascade" }),
  zoomMeetingId: text("zoom_meeting_id").notNull(),
  joinUrl: text("join_url").notNull(),
  startUrl: text("start_url"),
  passcode: text("passcode"),
  ...timestamps,
});
