import { boolean, integer, pgEnum, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";
import { timestamps, ulidFk, ulidPk, utcTimestamp, virusScanStatusEnum } from "./_common";
import { users } from "./identity";
import { subjects, courses } from "./academic";
import { contentReportStatusEnum } from "./content";

/**
 * Communication domain: parent-inclusive/staff-monitored conversations (spec §11.7 — never a
 * private adult↔child channel) and the Stack-Overflow-style discussion spaces (spec §9).
 * `abuse_reports.status` reuses `content_report_status` from the content domain — both are the
 * same open/reviewing/resolved/dismissed moderation lifecycle.
 */

export const conversationTypeEnum = pgEnum("conversation_type", [
  "parent_tutor",
  "group_lesson",
  "support",
  "discussion_thread",
]);
export const conversationMemberRoleEnum = pgEnum("conversation_member_role", [
  "parent",
  "tutor",
  "student",
  "staff",
]);
export const discussionQuestionStatusEnum = pgEnum("discussion_question_status", [
  "open",
  "answered",
  "closed",
]);
export const answerReviewStatusEnum = pgEnum("answer_review_status", [
  "approved",
  "flagged",
  "removed",
]);
export const abuseReportTargetTypeEnum = pgEnum("abuse_report_target_type", [
  "message",
  "discussion_question",
  "discussion_answer",
  "user",
  "resource",
]);

/** No private adult↔child DM type exists here by design — `type` is always parent-inclusive or staff-monitored. */
export const conversations = pgTable("conversations", {
  id: ulidPk(),
  type: conversationTypeEnum("type").notNull(),
  title: text("title"),
  createdByUserId: ulidFk("created_by_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  isMonitored: boolean("is_monitored").notNull().default(true),
  ...timestamps,
});

export const conversationMembers = pgTable(
  "conversation_members",
  {
    id: ulidPk(),
    conversationId: ulidFk("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    userId: ulidFk("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    role: conversationMemberRoleEnum("role").notNull(),
    joinedAt: utcTimestamp("joined_at").notNull().defaultNow(),
    leftAt: utcTimestamp("left_at"),
    createdAt: timestamps.createdAt,
  },
  (table) => [uniqueIndex("conversation_members_unique").on(table.conversationId, table.userId)],
);

/** No delete path — tutors cannot delete messages (spec §4.3). `isRedacted` is the only admin-side removal, and is audited. */
export const messages = pgTable("messages", {
  id: ulidPk(),
  conversationId: ulidFk("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  senderUserId: ulidFk("sender_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  body: text("body").notNull(),
  sentAt: utcTimestamp("sent_at").notNull().defaultNow(),
  editedAt: utcTimestamp("edited_at"),
  isRedacted: boolean("is_redacted").notNull().default(false),
  createdAt: timestamps.createdAt,
});

export const messageAttachments = pgTable("message_attachments", {
  id: ulidPk(),
  messageId: ulidFk("message_id")
    .notNull()
    .references(() => messages.id, { onDelete: "cascade" }),
  fileKey: text("file_key").notNull(),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  virusScanStatus: virusScanStatusEnum("virus_scan_status").notNull().default("pending"),
  createdAt: timestamps.createdAt,
});

export const messageReads = pgTable(
  "message_reads",
  {
    id: ulidPk(),
    messageId: ulidFk("message_id")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    userId: ulidFk("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    readAt: utcTimestamp("read_at").notNull().defaultNow(),
  },
  (table) => [uniqueIndex("message_reads_unique").on(table.messageId, table.userId)],
);

export const discussionSpaces = pgTable("discussion_spaces", {
  id: ulidPk(),
  courseId: ulidFk("course_id").references(() => courses.id, { onDelete: "restrict" }),
  subjectId: ulidFk("subject_id").references(() => subjects.id, { onDelete: "restrict" }),
  title: text("title").notNull(),
  description: text("description"),
  ageAppropriateTier: text("age_appropriate_tier"),
  ...timestamps,
});

export const discussionQuestions = pgTable("discussion_questions", {
  id: ulidPk(),
  discussionSpaceId: ulidFk("discussion_space_id")
    .notNull()
    .references(() => discussionSpaces.id, { onDelete: "restrict" }),
  authorUserId: ulidFk("author_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  title: text("title").notNull(),
  body: text("body").notNull(),
  status: discussionQuestionStatusEnum("status").notNull().default("open"),
  ...timestamps,
});

export const discussionAnswers = pgTable("discussion_answers", {
  id: ulidPk(),
  discussionQuestionId: ulidFk("discussion_question_id")
    .notNull()
    .references(() => discussionQuestions.id, { onDelete: "cascade" }),
  authorUserId: ulidFk("author_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  body: text("body").notNull(),
  isAccepted: boolean("is_accepted").notNull().default(false),
  ...timestamps,
});

/** Moderation pass on an answer (staff/tutor review), distinct from the asker marking it accepted. */
export const answerReviews = pgTable("answer_reviews", {
  id: ulidPk(),
  discussionAnswerId: ulidFk("discussion_answer_id")
    .notNull()
    .references(() => discussionAnswers.id, { onDelete: "cascade" }),
  reviewedByUserId: ulidFk("reviewed_by_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  status: answerReviewStatusEnum("status").notNull(),
  notes: text("notes"),
  createdAt: timestamps.createdAt,
});

/** `targetId` is a loose pointer into whichever table `targetType` names — no DB FK, target table varies. */
export const abuseReports = pgTable("abuse_reports", {
  id: ulidPk(),
  reportedByUserId: ulidFk("reported_by_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  targetType: abuseReportTargetTypeEnum("target_type").notNull(),
  targetId: text("target_id").notNull(),
  reason: text("reason").notNull(),
  status: contentReportStatusEnum("status").notNull().default("open"),
  resolvedByUserId: ulidFk("resolved_by_user_id").references(() => users.id),
  resolvedAt: utcTimestamp("resolved_at"),
  ...timestamps,
});
