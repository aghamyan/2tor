import { pgEnum, pgTable, text } from "drizzle-orm/pg-core";
import { timestamps, ulidFk, ulidPk, utcTimestamp } from "./_common";
import { users } from "./identity";
import { studentProfiles } from "./families";
import { tutorProfiles } from "./tutors";
import { subjects } from "./academic";

/**
 * Matching domain: manual tutor↔student matching (spec §3.1 — "Manual student-tutor matching").
 * `tutor_student_assignments` is the source of truth for tutor access — every cross-domain
 * "can this tutor see this student" check reduces to "is there an active, unexpired assignment
 * row," which is why nothing here cascades on delete.
 */

export const tutorAssignmentStatusEnum = pgEnum("tutor_assignment_status", [
  "proposed",
  "active",
  "ended",
  "rejected",
]);
export const assignmentRequestStatusEnum = pgEnum("assignment_request_status", [
  "pending",
  "matched",
  "closed",
  "cancelled",
]);

/** Time-bounded tutor access grant. Access is only valid while `status = 'active'` and `end_at` is null or in the future. */
export const tutorStudentAssignments = pgTable("tutor_student_assignments", {
  id: ulidPk(),
  tutorProfileId: ulidFk("tutor_profile_id")
    .notNull()
    .references(() => tutorProfiles.id, { onDelete: "restrict" }),
  studentProfileId: ulidFk("student_profile_id")
    .notNull()
    .references(() => studentProfiles.id, { onDelete: "restrict" }),
  subjectId: ulidFk("subject_id").references(() => subjects.id, { onDelete: "restrict" }),
  status: tutorAssignmentStatusEnum("status").notNull().default("proposed"),
  startAt: utcTimestamp("start_at").notNull(),
  /** Null while active/indefinite. Setting this ends the tutor's access to the student. */
  endAt: utcTimestamp("end_at"),
  endedReason: text("ended_reason"),
  createdByUserId: ulidFk("created_by_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  ...timestamps,
});

export const assignmentRequests = pgTable("assignment_requests", {
  id: ulidPk(),
  requestedByUserId: ulidFk("requested_by_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  studentProfileId: ulidFk("student_profile_id")
    .notNull()
    .references(() => studentProfiles.id, { onDelete: "restrict" }),
  subjectId: ulidFk("subject_id").references(() => subjects.id, { onDelete: "restrict" }),
  preferredTutorProfileId: ulidFk("preferred_tutor_profile_id").references(() => tutorProfiles.id, {
    onDelete: "restrict",
  }),
  status: assignmentRequestStatusEnum("status").notNull().default("pending"),
  notes: text("notes"),
  ...timestamps,
});

/** Staff-only notes on matching decisions — never parent/tutor visible. */
export const matchingNotes = pgTable("matching_notes", {
  id: ulidPk(),
  assignmentRequestId: ulidFk("assignment_request_id").references(() => assignmentRequests.id, {
    onDelete: "restrict",
  }),
  tutorStudentAssignmentId: ulidFk("tutor_student_assignment_id").references(
    () => tutorStudentAssignments.id,
    {
      onDelete: "restrict",
    },
  ),
  authorUserId: ulidFk("author_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  note: text("note").notNull(),
  createdAt: timestamps.createdAt,
});
