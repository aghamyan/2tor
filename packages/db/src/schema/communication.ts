import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  uniqueIndex,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { timestamps, ulidFk, ulidPk, utcTimestamp, virusScanStatusEnum } from "./_common";
import { users } from "./identity";
import { subjects, courses, skills } from "./academic";
import { studentProfiles } from "./families";
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
/**
 * `open` doubles as "unanswered" in the MathOverflow product surface (spec: no separate DB value
 * to avoid an app-layer rename touching every existing row/query). `pending_moderation` is set by
 * `detectPii` (see `packages/domain/discussions/services.ts`) and is not student-visible.
 */
export const discussionQuestionStatusEnum = pgEnum("discussion_question_status", [
  "open",
  "answered",
  "accepted",
  "tutor_verified",
  "needs_tutor_review",
  "needs_clarification",
  "closed",
  "locked",
  "duplicate",
  "resolved",
  "pending_moderation",
]);
export const answerReviewStatusEnum = pgEnum("answer_review_status", [
  "approved",
  "flagged",
  "removed",
]);
/**
 * `private_support` and `group_shared` are the original spec §9 values (student+parent+tutor+staff,
 * and group-member-only, respectively — see `packages/domain/discussions/README.md`). `tutors_only`
 * and `community` are additive MathOverflow visibility tiers. `community` still means "every
 * authenticated platform member with an applicable role," never an unauthenticated/public reader —
 * every MathOverflow page keeps `robots: noindex`.
 */
export const discussionVisibilityEnum = pgEnum("discussion_visibility", [
  "private_support",
  "group_shared",
  "tutors_only",
  "community",
]);
export const discussionQuestionTypeEnum = pgEnum("discussion_question_type", [
  "concept_explanation",
  "homework_help",
  "check_my_solution",
  "alternative_method",
  "exam_preparation",
  "proof_review",
  "general_discussion",
]);
/** Kept distinct from `is_accepted` (asker's choice) and tutor star ratings (below) by design. */
export const discussionAnswerVerificationStatusEnum = pgEnum(
  "discussion_answer_verification_status",
  [
    "unverified",
    "correct",
    "mostly_correct",
    "correct_approach_arithmetic_error",
    "needs_revision",
    "incorrect",
    "incomplete_explanation",
  ],
);
export const abuseReportTargetTypeEnum = pgEnum("abuse_report_target_type", [
  "message",
  "discussion_question",
  "discussion_answer",
  "discussion_comment",
  "user",
  "resource",
]);
/** Coarse triage bucket; `null` means not yet triaged. */
export const abuseReportSeverityEnum = pgEnum("abuse_report_severity", [
  "low",
  "medium",
  "high",
  "critical",
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

/**
 * MathOverflow (spec §9 evolved): `discussionSpaceId` is now optional — the tested business logic
 * in `packages/domain/discussions/services.ts` scopes a question directly via
 * `{courseId, groupId/relatedClassId, subjectId}` rather than requiring a pre-created space, so the
 * original NOT NULL was relaxed rather than backfilling a space per question. `groupId` has no
 * dedicated table; it is a `courses.id` where `courses.is_group = true` (see
 * `packages/domain/discussions/drizzle-database.ts` for the `isStudentInGroup`/
 * `isTutorAssignedToGroup` predicates built on `enrollments`/`tutor_student_assignments`).
 */
export const discussionQuestions = pgTable(
  "discussion_questions",
  {
    id: ulidPk(),
    discussionSpaceId: ulidFk("discussion_space_id").references(() => discussionSpaces.id, {
      onDelete: "restrict",
    }),
    authorUserId: ulidFk("author_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    studentProfileId: ulidFk("student_profile_id")
      .notNull()
      .references(() => studentProfiles.id, { onDelete: "restrict" }),
    /** Snapshotted at post time ("firstName · controlledIdentifier" — never a legal/surname), not
     *  re-derived on every read — matches `packages/domain/discussions/services.ts:displayName()`. */
    authorDisplayName: text("author_display_name").notNull(),
    title: text("title").notNull(),
    /** URL-safe, unique, generated from `title` + a short suffix at creation time (never user-set). */
    slug: text("slug").notNull().unique(),
    body: text("body").notNull(),
    bodyFormat: text("body_format").notNull().default("markdown"),
    subjectId: ulidFk("subject_id").references(() => subjects.id, { onDelete: "restrict" }),
    /** "Topic" in the product spec maps onto the existing granular `skills` reference table. */
    topicId: ulidFk("topic_id").references(() => skills.id, { onDelete: "restrict" }),
    gradeLevel: text("grade_level"),
    courseId: ulidFk("course_id").references(() => courses.id, { onDelete: "restrict" }),
    questionType: discussionQuestionTypeEnum("question_type")
      .notNull()
      .default("general_discussion"),
    whatTried: text("what_tried"),
    visibility: discussionVisibilityEnum("visibility").notNull().default("private_support"),
    /** `relatedClassId` is distinct from `groupId`/`courseId` scoping: a specific class the asker links for context. */
    relatedClassId: ulidFk("related_class_id").references(() => courses.id, {
      onDelete: "set null",
    }),
    status: discussionQuestionStatusEnum("status").notNull().default("open"),
    /**
     * Soft reference by design (no `.references()`): avoids a circular FK with `discussion_answers`,
     * which itself references this table. Validated in `services.ts` — the accepted answer must
     * exist, be active, and belong to this question — never enforced at the DB layer.
     */
    acceptedAnswerId: ulidFk("accepted_answer_id"),
    /** Loose pointer (no FK) for the same reason `duplicate_of_question_id`/self-references elsewhere in
     *  this schema stay soft — see `abuse_reports.target_id` for the established precedent. */
    duplicateOfQuestionId: ulidFk("duplicate_of_question_id").references(
      (): AnyPgColumn => discussionQuestions.id,
    ),
    /** Detection metadata only (kind + timestamp) — the matched PII value itself is never stored. */
    piiFlags: jsonb("pii_flags").notNull().default([]),
    viewCount: integer("view_count").notNull().default(0),
    lastActivityAt: utcTimestamp("last_activity_at").notNull().defaultNow(),
    lockedAt: utcTimestamp("locked_at"),
    lockedById: ulidFk("locked_by_id").references(() => users.id),
    closedAt: utcTimestamp("closed_at"),
    closedById: ulidFk("closed_by_id").references(() => users.id),
    closedReason: text("closed_reason"),
    deletedAt: utcTimestamp("deleted_at"),
    ...timestamps,
  },
  (table) => [
    index("discussion_questions_status_idx").on(table.status),
    index("discussion_questions_visibility_idx").on(table.visibility),
    index("discussion_questions_author_idx").on(table.authorUserId),
    index("discussion_questions_subject_idx").on(table.subjectId),
    index("discussion_questions_topic_idx").on(table.topicId),
    index("discussion_questions_course_idx").on(table.courseId),
    index("discussion_questions_grade_level_idx").on(table.gradeLevel),
    index("discussion_questions_last_activity_idx").on(table.lastActivityAt),
    index("discussion_questions_created_at_idx").on(table.createdAt),
    index("discussion_questions_search_idx").using(
      "gin",
      sql`to_tsvector('english', coalesce(${table.title}, '') || ' ' || coalesce(${table.body}, ''))`,
    ),
  ],
);

export const discussionAnswers = pgTable(
  "discussion_answers",
  {
    id: ulidPk(),
    discussionQuestionId: ulidFk("discussion_question_id")
      .notNull()
      .references(() => discussionQuestions.id, { onDelete: "cascade" }),
    authorUserId: ulidFk("author_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    authorDisplayName: text("author_display_name").notNull(),
    body: text("body").notNull(),
    bodyFormat: text("body_format").notNull().default("markdown"),
    /** Kept in sync with `discussion_questions.accepted_answer_id` inside the same transaction — that
     *  column (not this boolean) is the source of truth; this exists for cheap "accepted answers by
     *  author" queries/indexes. */
    isAccepted: boolean("is_accepted").notNull().default(false),
    isTutorAnswer: boolean("is_tutor_answer").notNull().default(false),
    verificationStatus: discussionAnswerVerificationStatusEnum("verification_status")
      .notNull()
      .default("unverified"),
    verificationNote: text("verification_note"),
    verifiedByUserId: ulidFk("verified_by_user_id").references(() => users.id),
    verifiedAt: utcTimestamp("verified_at"),
    /** Denormalized from `discussion_answer_tutor_ratings`; never the source of truth — see
     *  `recalculateAnswerRatingAggregate` in `packages/domain/discussions/services.ts`. One decimal
     *  place of real precision is enough (`numeric(3,2)` covers 0.00–5.00). */
    tutorRatingAverage: numeric("tutor_rating_average", { precision: 3, scale: 2 }),
    tutorRatingCount: integer("tutor_rating_count").notNull().default(0),
    revisedAfterRatingAt: utcTimestamp("revised_after_rating_at"),
    piiFlags: jsonb("pii_flags").notNull().default([]),
    lockedAt: utcTimestamp("locked_at"),
    lockedById: ulidFk("locked_by_id").references(() => users.id),
    deletedAt: utcTimestamp("deleted_at"),
    ...timestamps,
  },
  (table) => [
    index("discussion_answers_question_idx").on(table.discussionQuestionId),
    index("discussion_answers_verification_status_idx").on(table.verificationStatus),
    index("discussion_answers_author_idx").on(table.authorUserId),
  ],
);

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
export const abuseReports = pgTable(
  "abuse_reports",
  {
    id: ulidPk(),
    reportedByUserId: ulidFk("reported_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    targetType: abuseReportTargetTypeEnum("target_type").notNull(),
    targetId: text("target_id").notNull(),
    reason: text("reason").notNull(),
    /** Free-text elaboration beyond `reason`'s short code — MathOverflow's moderation queue detail view. */
    details: text("details"),
    severity: abuseReportSeverityEnum("severity"),
    status: contentReportStatusEnum("status").notNull().default("open"),
    /**
     * Kept as its own column rather than a 5th `content_report_status` enum value — that enum is
     * shared with `packages/domain/content`/`administration`, whose Drizzle row types hardcode the
     * original 4 values; adding a value there is a cross-module type break (confirmed: it broke
     * `packages/domain/{administration,content}/drizzle-database.ts` typecheck). MathOverflow's
     * "Escalated" moderation status is `status = 'reviewing' AND escalated = true` instead — see
     * `packages/domain/discussions/drizzle-database.ts`'s report row mapping.
     */
    escalated: boolean("escalated").notNull().default(false),
    assignedModeratorId: ulidFk("assigned_moderator_id").references(() => users.id),
    resolvedByUserId: ulidFk("resolved_by_user_id").references(() => users.id),
    resolutionNote: text("resolution_note"),
    resolvedAt: utcTimestamp("resolved_at"),
    ...timestamps,
  },
  (table) => [
    index("abuse_reports_status_idx").on(table.status),
    index("abuse_reports_assigned_moderator_idx").on(table.assignedModeratorId),
    index("abuse_reports_target_idx").on(table.targetType, table.targetId),
  ],
);
