import { boolean, date, integer, pgEnum, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";
import { timestamps, ulidFk, ulidPk, utcTimestamp, virusScanStatusEnum } from "./_common";
import { users } from "./identity";
import { parentProfiles, studentProfiles } from "./families";
import { subjects, courses } from "./academic";
import { rubrics } from "./assignments";

/**
 * Projects domain: project-based learning work (spec §6.5) — individual or group, always via
 * `project_members` (no owner column on `projects` itself, so group projects aren't a special
 * case) — plus the student portfolio, which requires explicit parent consent before any public
 * sharing (spec §11.3).
 */

export const projectStatusEnum = pgEnum("project_status", [
  "planned",
  "in_progress",
  "submitted",
  "reviewed",
  "completed",
]);
export const portfolioVisibilityEnum = pgEnum("portfolio_visibility", [
  "private",
  "parent_only",
  "public",
]);

export const projects = pgTable("projects", {
  id: ulidPk(),
  courseId: ulidFk("course_id").references(() => courses.id, { onDelete: "restrict" }),
  subjectId: ulidFk("subject_id")
    .notNull()
    .references(() => subjects.id, { onDelete: "restrict" }),
  title: text("title").notNull(),
  description: text("description"),
  isGroup: boolean("is_group").notNull().default(false),
  status: projectStatusEnum("status").notNull().default("planned"),
  startDate: date("start_date"),
  dueDate: date("due_date"),
  createdByUserId: ulidFk("created_by_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  ...timestamps,
});

export const projectMembers = pgTable(
  "project_members",
  {
    id: ulidPk(),
    projectId: ulidFk("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    studentProfileId: ulidFk("student_profile_id")
      .notNull()
      .references(() => studentProfiles.id, { onDelete: "restrict" }),
    roleLabel: text("role_label"),
    joinedAt: utcTimestamp("joined_at").notNull().defaultNow(),
    createdAt: timestamps.createdAt,
  },
  (table) => [uniqueIndex("project_members_unique").on(table.projectId, table.studentProfileId)],
);

export const projectUpdates = pgTable("project_updates", {
  id: ulidPk(),
  projectId: ulidFk("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  authorUserId: ulidFk("author_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  note: text("note").notNull(),
  progressPercentage: integer("progress_percentage"),
  createdAt: timestamps.createdAt,
});

export const projectFiles = pgTable("project_files", {
  id: ulidPk(),
  projectId: ulidFk("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  uploadedByUserId: ulidFk("uploaded_by_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  fileKey: text("file_key").notNull(),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  virusScanStatus: virusScanStatusEnum("virus_scan_status").notNull().default("pending"),
  createdAt: timestamps.createdAt,
});

export const projectRubrics = pgTable(
  "project_rubrics",
  {
    id: ulidPk(),
    projectId: ulidFk("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    rubricId: ulidFk("rubric_id")
      .notNull()
      .references(() => rubrics.id, { onDelete: "restrict" }),
    createdAt: timestamps.createdAt,
  },
  (table) => [uniqueIndex("project_rubrics_unique").on(table.projectId, table.rubricId)],
);

/** Sharing requires `portfolio_sharing_consents`; `visibility` alone never authorizes public display. */
export const portfolioItems = pgTable("portfolio_items", {
  id: ulidPk(),
  studentProfileId: ulidFk("student_profile_id")
    .notNull()
    .references(() => studentProfiles.id, { onDelete: "restrict" }),
  projectId: ulidFk("project_id").references(() => projects.id, { onDelete: "restrict" }),
  title: text("title").notNull(),
  description: text("description"),
  fileKey: text("file_key"),
  linkUrl: text("link_url"),
  visibility: portfolioVisibilityEnum("visibility").notNull().default("private"),
  ...timestamps,
});

export const portfolioSharingConsents = pgTable("portfolio_sharing_consents", {
  id: ulidPk(),
  portfolioItemId: ulidFk("portfolio_item_id")
    .notNull()
    .references(() => portfolioItems.id, { onDelete: "restrict" }),
  parentProfileId: ulidFk("parent_profile_id")
    .notNull()
    .references(() => parentProfiles.id, { onDelete: "restrict" }),
  consentGivenAt: utcTimestamp("consent_given_at").notNull().defaultNow(),
  revokedAt: utcTimestamp("revoked_at"),
  createdAt: timestamps.createdAt,
});
