import {
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  uniqueIndex,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { timestamps, ulidFk, ulidPk, utcTimestamp, virusScanStatusEnum } from "./_common";
import { users } from "./identity";
import { discussionAnswers, discussionQuestions } from "./communication";

/**
 * MathOverflow satellite tables. `discussion_questions`/`discussion_answers`/`discussion_spaces`/
 * `abuse_reports` remain in `communication.ts` (spec §9's original home, and already coupled to
 * `packages/domain/administration/{retention,deletion-executor}.ts` by literal table name) — every
 * table here is net new, so it lives separately rather than growing that file further. Everything
 * cascades from its parent question/answer: `deletion-executor.ts`'s plain
 * `db.delete(discussionQuestions).where(eq(id, ...))` therefore still fully erases a MathOverflow
 * thread (ratings, comments, corrections, follows, bookmarks, attachments, tags, revisions,
 * notifications included) without that file needing to know any of these tables exist.
 */

/**
 * "Mark helpful" — deliberately positive-only (no downvote), one per (answer, voter), rate-limited
 * at the service layer (5/day). Never exposed as a ranking/leaderboard on its own; it only breaks
 * ties within an answer-ordering tier (see `ordering.ts`) behind acceptance/verification/rating.
 */
export const discussionHelpfulVotes = pgTable(
  "discussion_helpful_votes",
  {
    id: ulidPk(),
    answerId: ulidFk("answer_id")
      .notNull()
      .references(() => discussionAnswers.id, { onDelete: "cascade" }),
    voterUserId: ulidFk("voter_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamps.createdAt,
  },
  (table) => [
    uniqueIndex("discussion_helpful_votes_unique").on(table.answerId, table.voterUserId),
    index("discussion_helpful_votes_voter_idx").on(table.voterUserId, table.createdAt),
  ],
);

export const discussionTags = pgTable("discussion_tags", {
  id: ulidPk(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  /** A semantic token name (e.g. "teal", "amber"), not a raw color value — resolved by the UI theme. */
  colorToken: text("color_token"),
  usageCount: integer("usage_count").notNull().default(0),
  ...timestamps,
});

export const discussionQuestionTags = pgTable(
  "discussion_question_tags",
  {
    id: ulidPk(),
    questionId: ulidFk("question_id")
      .notNull()
      .references(() => discussionQuestions.id, { onDelete: "cascade" }),
    tagId: ulidFk("tag_id")
      .notNull()
      .references(() => discussionTags.id, { onDelete: "cascade" }),
    createdAt: timestamps.createdAt,
  },
  (table) => [
    uniqueIndex("discussion_question_tags_unique").on(table.questionId, table.tagId),
    index("discussion_question_tags_tag_idx").on(table.tagId),
  ],
);

/**
 * One active rating per (answer, tutor) — enforced by the partial unique index below, mirroring
 * `identity.ts`'s `user_roles_active_unique` pattern. `rating` is always the tutor's current whole
 * 1–5 submission; the denormalized average/count live on `discussion_answers` and are rebuilt from
 * these rows by `recalculateAnswerRatingAggregate` (see `packages/domain/discussions/services.ts`)
 * — this table is the only source of truth, never the aggregate columns.
 */
export const discussionAnswerTutorRatings = pgTable(
  "discussion_answer_tutor_ratings",
  {
    id: ulidPk(),
    answerId: ulidFk("answer_id")
      .notNull()
      .references(() => discussionAnswers.id, { onDelete: "cascade" }),
    tutorId: ulidFk("tutor_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    tutorDisplayName: text("tutor_display_name").notNull(),
    rating: integer("rating").notNull(),
    /** Public, shown alongside the rating. Never the tutor's private moderation notes. */
    publicFeedback: text("public_feedback"),
    deletedAt: utcTimestamp("deleted_at"),
    invalidatedAt: utcTimestamp("invalidated_at"),
    invalidatedById: ulidFk("invalidated_by_id").references(() => users.id),
    invalidationReason: text("invalidation_reason"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("discussion_answer_tutor_ratings_active_unique")
      .on(table.answerId, table.tutorId)
      .where(sql`${table.deletedAt} is null and ${table.invalidatedAt} is null`),
    check(
      "discussion_answer_tutor_ratings_range",
      sql`${table.rating} >= 1 and ${table.rating} <= 5`,
    ),
    index("discussion_answer_tutor_ratings_answer_idx").on(table.answerId),
    index("discussion_answer_tutor_ratings_tutor_idx").on(table.tutorId),
    index("discussion_answer_tutor_ratings_rating_idx").on(table.rating),
  ],
);

/**
 * One level of threading only: a comment may reply to another comment, but a reply-to-a-reply is
 * rejected at the service layer (spec: "avoid deeply nested discussion trees"), not modeled here.
 */
export const discussionComments = pgTable(
  "discussion_comments",
  {
    id: ulidPk(),
    authorUserId: ulidFk("author_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    authorDisplayName: text("author_display_name").notNull(),
    questionId: ulidFk("question_id").references(() => discussionQuestions.id, {
      onDelete: "cascade",
    }),
    answerId: ulidFk("answer_id").references(() => discussionAnswers.id, { onDelete: "cascade" }),
    parentCommentId: ulidFk("parent_comment_id").references(
      (): AnyPgColumn => discussionComments.id,
      { onDelete: "cascade" },
    ),
    body: text("body").notNull(),
    deletedAt: utcTimestamp("deleted_at"),
    ...timestamps,
  },
  (table) => [
    check(
      "discussion_comments_exactly_one_target",
      sql`(${table.questionId} is not null) <> (${table.answerId} is not null)`,
    ),
    index("discussion_comments_question_idx").on(table.questionId),
    index("discussion_comments_answer_idx").on(table.answerId),
  ],
);

export const discussionFollows = pgTable(
  "discussion_follows",
  {
    id: ulidPk(),
    userId: ulidFk("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    questionId: ulidFk("question_id")
      .notNull()
      .references(() => discussionQuestions.id, { onDelete: "cascade" }),
    createdAt: timestamps.createdAt,
  },
  (table) => [uniqueIndex("discussion_follows_unique").on(table.userId, table.questionId)],
);

export const discussionBookmarks = pgTable(
  "discussion_bookmarks",
  {
    id: ulidPk(),
    userId: ulidFk("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    questionId: ulidFk("question_id")
      .notNull()
      .references(() => discussionQuestions.id, { onDelete: "cascade" }),
    createdAt: timestamps.createdAt,
  },
  (table) => [uniqueIndex("discussion_bookmarks_unique").on(table.userId, table.questionId)],
);

export const discussionCorrectionStatusEnum = pgEnum("discussion_correction_status", [
  "pending",
  "accepted",
  "partially_accepted",
  "rejected",
  "resolved",
]);

/** A suggested fix to an answer — never overwrites it. The answer author decides what to do with it. */
export const discussionCorrections = pgTable("discussion_corrections", {
  id: ulidPk(),
  answerId: ulidFk("answer_id")
    .notNull()
    .references(() => discussionAnswers.id, { onDelete: "cascade" }),
  proposedById: ulidFk("proposed_by_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  proposedByDisplayName: text("proposed_by_display_name").notNull(),
  issueDescription: text("issue_description").notNull(),
  proposedCorrection: text("proposed_correction").notNull(),
  explanation: text("explanation"),
  status: discussionCorrectionStatusEnum("status").notNull().default("pending"),
  authorResponse: text("author_response"),
  resolvedById: ulidFk("resolved_by_id").references(() => users.id),
  resolutionNote: text("resolution_note"),
  resolvedAt: utcTimestamp("resolved_at"),
  ...timestamps,
});

export const discussionRevisionEntityTypeEnum = pgEnum("discussion_revision_entity_type", [
  "question",
  "answer",
]);

/** `entityId` is a loose pointer (question or answer id) — same established pattern as `abuse_reports.target_id`. */
export const discussionRevisions = pgTable(
  "discussion_revisions",
  {
    id: ulidPk(),
    entityType: discussionRevisionEntityTypeEnum("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    editorId: ulidFk("editor_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    previousBody: text("previous_body").notNull(),
    newBody: text("new_body").notNull(),
    editReason: text("edit_reason"),
    createdAt: timestamps.createdAt,
  },
  (table) => [index("discussion_revisions_entity_idx").on(table.entityType, table.entityId)],
);

/**
 * Module-owned notification log, deliberately not routed through `@app/notifications` — that
 * package's `NotificationType` union is closed and a module must not extend a shared package's
 * enum (see `packages/domain/discussions/README.md` and the implementation summary's "Remaining
 * limitations" for the tradeoff). Surfaced today only inside MathOverflow's own "My activity" view.
 */
export const discussionNotificationTypeEnum = pgEnum("discussion_notification_type", [
  "question_answered",
  "question_commented",
  "user_mentioned",
  "answer_accepted",
  "answer_unaccepted",
  "answer_tutor_verified",
  "answer_revision_requested",
  "answer_tutor_rated",
  "answer_tutor_rating_updated",
  "answer_tutor_rating_removed",
  "answer_correction_suggested",
  "answer_correction_resolved",
  "followed_question_activity",
  "content_moderation_updated",
]);

export const discussionNotifications = pgTable(
  "discussion_notifications",
  {
    id: ulidPk(),
    recipientId: ulidFk("recipient_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    actorId: ulidFk("actor_id").references(() => users.id),
    type: discussionNotificationTypeEnum("type").notNull(),
    questionId: ulidFk("question_id").references(() => discussionQuestions.id, {
      onDelete: "cascade",
    }),
    answerId: ulidFk("answer_id").references(() => discussionAnswers.id, { onDelete: "cascade" }),
    ratingId: ulidFk("rating_id").references(() => discussionAnswerTutorRatings.id, {
      onDelete: "cascade",
    }),
    readAt: utcTimestamp("read_at"),
    createdAt: timestamps.createdAt,
  },
  (table) => [index("discussion_notifications_recipient_idx").on(table.recipientId, table.readAt)],
);

/** JPEG/PNG/PDF only, quarantined until `virusScanStatus` clears — see `services.ts:uploadQuestionAttachment`. */
export const discussionAttachments = pgTable("discussion_attachments", {
  id: ulidPk(),
  questionId: ulidFk("question_id")
    .notNull()
    .references(() => discussionQuestions.id, { onDelete: "cascade" }),
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
