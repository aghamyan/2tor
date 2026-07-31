import {
  boolean,
  date,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { timestamps, ulidFk, ulidPk, utcTimestamp } from "./_common";
import { users } from "./identity";
import { subjects } from "./academic";

/**
 * Tutors domain: public tutor profile, teaching capabilities (subjects/grades/languages/
 * availability), and the verification/training/suspension trail required for child-safety
 * compliance (spec §11.6). `tutor_verifications` never lets a tutor approve their own record —
 * that rule is enforced at the app layer (`verified_by_user_id` must differ from the tutor's own
 * `user_id`), not by a DB constraint.
 */

export const tutorProfileStatusEnum = pgEnum("tutor_profile_status", [
  "pending",
  "active",
  "suspended",
  "offboarded",
]);
export const tutorDocumentTypeEnum = pgEnum("tutor_document_type", [
  "identity",
  "education",
  "certification",
  "background_check",
  "other",
]);
export const tutorDocumentStatusEnum = pgEnum("tutor_document_status", [
  "pending",
  "approved",
  "rejected",
]);
export const tutorVerificationTypeEnum = pgEnum("tutor_verification_type", [
  "identity",
  "education",
  "background_check",
  "reference",
  "safeguarding_training",
]);
export const tutorVerificationStatusEnum = pgEnum("tutor_verification_status", [
  "pending",
  "passed",
  "failed",
  "waived",
]);
export const languageProficiencyEnum = pgEnum("language_proficiency", [
  "native",
  "fluent",
  "conversational",
]);
export const tutorTrainingTypeEnum = pgEnum("tutor_training_type", [
  "safeguarding",
  "platform_onboarding",
  "subject_specific",
  "other",
]);
export const tutorTrainingStatusEnum = pgEnum("tutor_training_status", [
  "assigned",
  "in_progress",
  "completed",
  "expired",
]);

/** 1:1 extension of `users`. Only fields explicitly approved for display belong on the public profile. */
export const tutorProfiles = pgTable("tutor_profiles", {
  id: ulidPk(),
  userId: ulidFk("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  publicDisplayName: text("public_display_name").notNull(),
  bio: text("bio"),
  headline: text("headline"),
  country: text("country"),
  yearsExperience: integer("years_experience"),
  educationSummary: text("education_summary"),
  status: tutorProfileStatusEnum("status").notNull().default("pending"),
  publicProfileApprovedAt: utcTimestamp("public_profile_approved_at"),
  ...timestamps,
});

export const tutorSubjects = pgTable(
  "tutor_subjects",
  {
    id: ulidPk(),
    tutorProfileId: ulidFk("tutor_profile_id")
      .notNull()
      .references(() => tutorProfiles.id, { onDelete: "cascade" }),
    subjectId: ulidFk("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "restrict" }),
    isPrimary: boolean("is_primary").notNull().default(false),
    createdAt: timestamps.createdAt,
  },
  (table) => [uniqueIndex("tutor_subjects_unique").on(table.tutorProfileId, table.subjectId)],
);

export const tutorGradeRanges = pgTable("tutor_grade_ranges", {
  id: ulidPk(),
  tutorProfileId: ulidFk("tutor_profile_id")
    .notNull()
    .references(() => tutorProfiles.id, { onDelete: "cascade" }),
  minGrade: integer("min_grade"),
  maxGrade: integer("max_grade"),
  includesAdult: boolean("includes_adult").notNull().default(false),
  createdAt: timestamps.createdAt,
});

export const tutorLanguages = pgTable(
  "tutor_languages",
  {
    id: ulidPk(),
    tutorProfileId: ulidFk("tutor_profile_id")
      .notNull()
      .references(() => tutorProfiles.id, { onDelete: "cascade" }),
    /** ISO 639-1 code, e.g. "en", "hy". */
    languageCode: text("language_code").notNull(),
    proficiency: languageProficiencyEnum("proficiency").notNull(),
    createdAt: timestamps.createdAt,
  },
  (table) => [uniqueIndex("tutor_languages_unique").on(table.tutorProfileId, table.languageCode)],
);

/** Recurring weekly availability. One-off exceptions live in `availability_exceptions` (scheduling domain). */
export const tutorAvailability = pgTable("tutor_availability", {
  id: ulidPk(),
  tutorProfileId: ulidFk("tutor_profile_id")
    .notNull()
    .references(() => tutorProfiles.id, { onDelete: "cascade" }),
  /** 0 = Sunday .. 6 = Saturday, interpreted in the tutor's `users.primary_timezone`. */
  dayOfWeek: integer("day_of_week").notNull(),
  startMinute: integer("start_minute").notNull(),
  endMinute: integer("end_minute").notNull(),
  effectiveFrom: date("effective_from"),
  effectiveTo: date("effective_to"),
  ...timestamps,
});

export const tutorDocuments = pgTable("tutor_documents", {
  id: ulidPk(),
  tutorProfileId: ulidFk("tutor_profile_id")
    .notNull()
    .references(() => tutorProfiles.id, { onDelete: "cascade" }),
  type: tutorDocumentTypeEnum("type").notNull(),
  fileKey: text("file_key").notNull(),
  status: tutorDocumentStatusEnum("status").notNull().default("pending"),
  uploadedAt: utcTimestamp("uploaded_at").notNull().defaultNow(),
  reviewedByUserId: ulidFk("reviewed_by_user_id").references(() => users.id),
  reviewedAt: utcTimestamp("reviewed_at"),
  notes: text("notes"),
  createdAt: timestamps.createdAt,
});

export const tutorVerifications = pgTable("tutor_verifications", {
  id: ulidPk(),
  tutorProfileId: ulidFk("tutor_profile_id")
    .notNull()
    .references(() => tutorProfiles.id, { onDelete: "cascade" }),
  type: tutorVerificationTypeEnum("type").notNull(),
  status: tutorVerificationStatusEnum("status").notNull().default("pending"),
  evidenceRef: text("evidence_ref"),
  verifiedByUserId: ulidFk("verified_by_user_id").references(() => users.id),
  verifiedAt: utcTimestamp("verified_at"),
  expiresAt: utcTimestamp("expires_at"),
  notes: text("notes"),
  ...timestamps,
});

export const tutorEvaluations = pgTable("tutor_evaluations", {
  id: ulidPk(),
  tutorProfileId: ulidFk("tutor_profile_id")
    .notNull()
    .references(() => tutorProfiles.id, { onDelete: "cascade" }),
  evaluatorUserId: ulidFk("evaluator_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  evaluationDate: date("evaluation_date").notNull(),
  score: numeric("score", { precision: 5, scale: 2 }),
  category: text("category"),
  comments: text("comments"),
  createdAt: timestamps.createdAt,
});

export const tutorTrainingRecords = pgTable("tutor_training_records", {
  id: ulidPk(),
  tutorProfileId: ulidFk("tutor_profile_id")
    .notNull()
    .references(() => tutorProfiles.id, { onDelete: "cascade" }),
  trainingType: tutorTrainingTypeEnum("training_type").notNull(),
  status: tutorTrainingStatusEnum("status").notNull().default("assigned"),
  completedAt: utcTimestamp("completed_at"),
  expiresAt: utcTimestamp("expires_at"),
  ...timestamps,
});

export const tutorSuspensions = pgTable("tutor_suspensions", {
  id: ulidPk(),
  tutorProfileId: ulidFk("tutor_profile_id")
    .notNull()
    .references(() => tutorProfiles.id, { onDelete: "cascade" }),
  reason: text("reason").notNull(),
  startAt: utcTimestamp("start_at").notNull(),
  /** Null = indefinite suspension. */
  endAt: utcTimestamp("end_at"),
  issuedByUserId: ulidFk("issued_by_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  liftedAt: utcTimestamp("lifted_at"),
  liftedByUserId: ulidFk("lifted_by_user_id").references(() => users.id),
  createdAt: timestamps.createdAt,
});
