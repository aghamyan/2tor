import { integer, pgEnum, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";
import { timestamps, ulidFk, ulidPk, utcTimestamp } from "./_common";
import { users } from "./identity";
import { studentProfiles } from "./families";
import { tutorProfiles } from "./tutors";
import { subjects, courses } from "./academic";

/**
 * Content domain: the resource library. Per spec §11.8, video resources are links/embeds only —
 * the platform never downloads or hosts copyrighted video, so `resource_links` stores a URL and
 * metadata, never a file.
 */

export const resourceTypeEnum = pgEnum("resource_type", [
  "document",
  "video",
  "link",
  "worksheet",
  "interactive",
]);
export const resourceOwnershipEnum = pgEnum("resource_ownership", [
  "company",
  "tutor_created",
  "third_party_licensed",
]);
export const resourcePublishStatusEnum = pgEnum("resource_publish_status", [
  "draft",
  "published",
  "archived",
]);
export const resourceLinkProviderEnum = pgEnum("resource_link_provider", ["youtube", "other"]);
/** `everyone`: all published resources (default). `grades`: gated by `resource_grade_levels`.
 *  `students`: gated by a direct `resource_assignments.student_profile_id` row — see
 *  `packages/domain/content/README.md` for why a second join table was deliberately avoided. */
export const resourceVisibilityEnum = pgEnum("resource_visibility", [
  "everyone",
  "grades",
  "students",
]);
export const tutorUploadStatusEnum = pgEnum("tutor_upload_status", [
  "pending_review",
  "approved",
  "rejected",
]);
export const contentReportStatusEnum = pgEnum("content_report_status", [
  "open",
  "reviewing",
  "resolved",
  "dismissed",
]);

export const resources = pgTable("resources", {
  id: ulidPk(),
  title: text("title").notNull(),
  description: text("description"),
  subjectId: ulidFk("subject_id").references(() => subjects.id, { onDelete: "restrict" }),
  type: resourceTypeEnum("type").notNull(),
  createdByUserId: ulidFk("created_by_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  ownership: resourceOwnershipEnum("ownership").notNull().default("company"),
  status: resourcePublishStatusEnum("status").notNull().default("draft"),
  /** Who can see this once published — everyone, specific grade levels, or specific students. */
  visibility: resourceVisibilityEnum("visibility").notNull().default("everyone"),
  ...timestamps,
});

/** Never a downloaded file — a link/embed reference only, per spec §11.8 copyright rules. */
export const resourceLinks = pgTable("resource_links", {
  id: ulidPk(),
  resourceId: ulidFk("resource_id")
    .notNull()
    .references(() => resources.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  provider: resourceLinkProviderEnum("provider").notNull().default("other"),
  title: text("title"),
  createdAt: timestamps.createdAt,
});

export const resourceTags = pgTable(
  "resource_tags",
  {
    id: ulidPk(),
    resourceId: ulidFk("resource_id")
      .notNull()
      .references(() => resources.id, { onDelete: "cascade" }),
    tag: text("tag").notNull(),
    createdAt: timestamps.createdAt,
  },
  (table) => [uniqueIndex("resource_tags_unique").on(table.resourceId, table.tag)],
);

/** Only meaningful when `resources.visibility = 'grades'`; matched against `student_profiles.grade_level` by exact text equality (same convention as `discussion_questions.grade_level`). */
export const resourceGradeLevels = pgTable(
  "resource_grade_levels",
  {
    id: ulidPk(),
    resourceId: ulidFk("resource_id")
      .notNull()
      .references(() => resources.id, { onDelete: "cascade" }),
    gradeLevel: text("grade_level").notNull(),
    createdAt: timestamps.createdAt,
  },
  (table) => [
    uniqueIndex("resource_grade_levels_unique").on(table.resourceId, table.gradeLevel),
  ],
);

export const resourceAssignments = pgTable("resource_assignments", {
  id: ulidPk(),
  resourceId: ulidFk("resource_id")
    .notNull()
    .references(() => resources.id, { onDelete: "restrict" }),
  studentProfileId: ulidFk("student_profile_id").references(() => studentProfiles.id, {
    onDelete: "restrict",
  }),
  courseId: ulidFk("course_id").references(() => courses.id, { onDelete: "restrict" }),
  assignedByUserId: ulidFk("assigned_by_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  assignedAt: utcTimestamp("assigned_at").notNull().defaultNow(),
  createdAt: timestamps.createdAt,
});

export const bookmarks = pgTable(
  "bookmarks",
  {
    id: ulidPk(),
    studentProfileId: ulidFk("student_profile_id")
      .notNull()
      .references(() => studentProfiles.id, { onDelete: "cascade" }),
    resourceId: ulidFk("resource_id")
      .notNull()
      .references(() => resources.id, { onDelete: "cascade" }),
    createdAt: timestamps.createdAt,
  },
  (table) => [uniqueIndex("bookmarks_unique").on(table.studentProfileId, table.resourceId)],
);

/** Tutor confirms upload rights before publish (spec §11.8: "Tutors must confirm they have rights to uploaded material"). */
export const tutorContentUploads = pgTable("tutor_content_uploads", {
  id: ulidPk(),
  tutorProfileId: ulidFk("tutor_profile_id")
    .notNull()
    .references(() => tutorProfiles.id, { onDelete: "restrict" }),
  resourceId: ulidFk("resource_id").references(() => resources.id, { onDelete: "restrict" }),
  fileKey: text("file_key"),
  fileName: text("file_name"),
  mimeType: text("mime_type"),
  sizeBytes: integer("size_bytes"),
  rightsConfirmedAt: utcTimestamp("rights_confirmed_at"),
  status: tutorUploadStatusEnum("status").notNull().default("pending_review"),
  reviewedByUserId: ulidFk("reviewed_by_user_id").references(() => users.id),
  reviewedAt: utcTimestamp("reviewed_at"),
  ...timestamps,
});

export const contentReports = pgTable("content_reports", {
  id: ulidPk(),
  resourceId: ulidFk("resource_id").references(() => resources.id, { onDelete: "restrict" }),
  reportedByUserId: ulidFk("reported_by_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  reason: text("reason").notNull(),
  status: contentReportStatusEnum("status").notNull().default("open"),
  resolvedByUserId: ulidFk("resolved_by_user_id").references(() => users.id),
  resolvedAt: utcTimestamp("resolved_at"),
  ...timestamps,
});
