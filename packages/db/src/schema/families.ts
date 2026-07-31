import { boolean, date, jsonb, pgEnum, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";
import { timestamps, ulidFk, ulidPk, utcTimestamp } from "./_common";
import { localeEnum, users } from "./identity";

/**
 * Families domain: parent and student profiles, the parent↔student link that every access-control
 * check in tutoring/scheduling depends on, and the child-privacy consent/request records required
 * by spec §11.
 */

export const parentStudentRelationEnum = pgEnum("parent_student_relation", ["parent", "guardian"]);
export const studentAccountStatusEnum = pgEnum("student_account_status", [
  "active",
  "inactive",
  "suspended",
]);
export const consentMethodEnum = pgEnum("consent_method", [
  "signed_form",
  "identity_verification",
  "video_call",
  "payment_card_verification",
  "other",
]);
export const privacyRequestTypeEnum = pgEnum("privacy_request_type", [
  "export",
  "deletion",
  "correction",
]);
export const privacyRequestStatusEnum = pgEnum("privacy_request_status", [
  "received",
  "in_review",
  "approved",
  "rejected",
  "completed",
]);

/** 1:1 extension of `users` — cascades with the user row since it's the same logical entity. */
export const parentProfiles = pgTable("parent_profiles", {
  id: ulidPk(),
  userId: ulidFk("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  fullName: text("full_name").notNull(),
  phone: text("phone"),
  secondaryPhone: text("secondary_phone"),
  /** Content language for tutor communication — independent from `users.locale` (interface language). */
  contentLanguagePreference: localeEnum("content_language_preference"),
  billingEmail: text("billing_email"),
  ...timestamps,
});

/**
 * A minor cannot self-register (spec §4.2), so this row is always created by a parent/admin
 * alongside a `users` row. Exact DOB is optional and field-level encrypted per §12.3; the
 * default is month/year or an age band per §11.2 data minimization.
 */
export const studentProfiles = pgTable("student_profiles", {
  id: ulidPk(),
  userId: ulidFk("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  preferredName: text("preferred_name").notNull(),
  gradeLevel: text("grade_level"),
  isAdultLearner: boolean("is_adult_learner").notNull().default(false),
  usState: text("us_state"),
  curriculumNotes: text("curriculum_notes"),
  textbookOrSyllabus: text("textbook_or_syllabus"),
  /** Practical teaching needs only — not a health diagnosis. Optional, parent-disclosed. */
  accommodations: text("accommodations"),
  /** Optional and field-level encrypted; collect only when legally/operationally justified. */
  dobExact: date("dob_exact"),
  /** Default minimization: "YYYY-MM" when exact DOB isn't collected. */
  dobYearMonth: text("dob_year_month"),
  /** Fallback minimization when even year/month isn't collected, e.g. "13-15". */
  ageBand: text("age_band"),
  status: studentAccountStatusEnum("status").notNull().default("active"),
  ...timestamps,
});

export const parentStudentLinks = pgTable(
  "parent_student_links",
  {
    id: ulidPk(),
    parentProfileId: ulidFk("parent_profile_id")
      .notNull()
      .references(() => parentProfiles.id, { onDelete: "restrict" }),
    studentProfileId: ulidFk("student_profile_id")
      .notNull()
      .references(() => studentProfiles.id, { onDelete: "restrict" }),
    relationship: parentStudentRelationEnum("relationship").notNull().default("parent"),
    isPrimary: boolean("is_primary").notNull().default(true),
    createdAt: timestamps.createdAt,
  },
  (table) => [
    uniqueIndex("parent_student_links_unique").on(table.parentProfileId, table.studentProfileId),
  ],
);

export const studentInterests = pgTable("student_interests", {
  id: ulidPk(),
  studentProfileId: ulidFk("student_profile_id")
    .notNull()
    .references(() => studentProfiles.id, { onDelete: "cascade" }),
  interest: text("interest").notNull(),
  createdAt: timestamps.createdAt,
});

export const studentPreferences = pgTable("student_preferences", {
  id: ulidPk(),
  studentProfileId: ulidFk("student_profile_id")
    .notNull()
    .unique()
    .references(() => studentProfiles.id, { onDelete: "cascade" }),
  preferredLessonStyle: text("preferred_lesson_style"),
  availabilityNotes: text("availability_notes"),
  notes: text("notes"),
  ...timestamps,
});

/**
 * One row per verifiable-parental-consent event (spec §11.1). `dataCategories` is a JSON array of
 * category keys; append a new row (don't mutate) whenever consent is re-obtained under a new version.
 */
export const consentRecords = pgTable("consent_records", {
  id: ulidPk(),
  parentProfileId: ulidFk("parent_profile_id")
    .notNull()
    .references(() => parentProfiles.id, { onDelete: "restrict" }),
  /** Null for account-level consent not tied to one specific child. */
  studentProfileId: ulidFk("student_profile_id").references(() => studentProfiles.id, {
    onDelete: "restrict",
  }),
  consentVersion: text("consent_version").notNull(),
  method: consentMethodEnum("method").notNull(),
  dataCategories: jsonb("data_categories").notNull().$type<string[]>(),
  identityEvidenceRef: text("identity_evidence_ref"),
  grantedAt: utcTimestamp("granted_at").notNull(),
  revokedAt: utcTimestamp("revoked_at"),
  createdAt: timestamps.createdAt,
});

/** Data export/deletion/correction requests. Deletion execution is tracked separately in `deletion_jobs`. */
export const privacyRequests = pgTable("privacy_requests", {
  id: ulidPk(),
  requestedByUserId: ulidFk("requested_by_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  parentProfileId: ulidFk("parent_profile_id").references(() => parentProfiles.id, {
    onDelete: "restrict",
  }),
  studentProfileId: ulidFk("student_profile_id").references(() => studentProfiles.id, {
    onDelete: "restrict",
  }),
  type: privacyRequestTypeEnum("type").notNull(),
  status: privacyRequestStatusEnum("status").notNull().default("received"),
  reason: text("reason"),
  notes: text("notes"),
  resolvedByUserId: ulidFk("resolved_by_user_id").references(() => users.id),
  resolvedAt: utcTimestamp("resolved_at"),
  ...timestamps,
});
