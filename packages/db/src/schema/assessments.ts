import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { timestamps, ulidFk, ulidPk, utcTimestamp } from "./_common";
import { users } from "./identity";
import { studentProfiles } from "./families";
import { subjects } from "./academic";

/**
 * Assessments domain: quizzes/exams/diagnostics with versioned question sets (spec §15) and the
 * anti-cheating event log from spec §10 (focus-loss/fullscreen-exit/answer-change tracking —
 * evidence for tutor review, never an automatic accusation).
 */

export const assessmentTypeEnum = pgEnum("assessment_type", [
  "diagnostic",
  "quiz",
  "exam",
  "practice",
]);
export const assessmentPublishStatusEnum = pgEnum("assessment_publish_status", [
  "draft",
  "published",
  "archived",
]);
export const assessmentQuestionTypeEnum = pgEnum("assessment_question_type", [
  "multiple_choice",
  "short_answer",
  "numeric",
  "essay",
  "code",
]);
export const assessmentAttemptStatusEnum = pgEnum("assessment_attempt_status", [
  "in_progress",
  "submitted",
  "graded",
  "abandoned",
]);
export const proctorModeEnum = pgEnum("proctor_mode", ["none", "camera_required"]);
export const assessmentEventTypeEnum = pgEnum("assessment_event_type", [
  "focus_loss",
  "fullscreen_exit",
  "tab_switch",
  "copy_attempt",
  "paste_attempt",
  "answer_change",
  "submitted",
]);

export const assessments = pgTable("assessments", {
  id: ulidPk(),
  subjectId: ulidFk("subject_id")
    .notNull()
    .references(() => subjects.id, { onDelete: "restrict" }),
  title: text("title").notNull(),
  description: text("description"),
  type: assessmentTypeEnum("type").notNull(),
  createdByUserId: ulidFk("created_by_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  status: assessmentPublishStatusEnum("status").notNull().default("draft"),
  ...timestamps,
});

/** Versioned so a later edit never changes the paper a past attempt was actually taken against. */
export const assessmentVersions = pgTable(
  "assessment_versions",
  {
    id: ulidPk(),
    assessmentId: ulidFk("assessment_id")
      .notNull()
      .references(() => assessments.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    changeSummary: text("change_summary"),
    publishedAt: utcTimestamp("published_at"),
    createdByUserId: ulidFk("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamps.createdAt,
  },
  (table) => [
    uniqueIndex("assessment_versions_unique").on(table.assessmentId, table.versionNumber),
  ],
);

export const assessmentQuestions = pgTable("assessment_questions", {
  id: ulidPk(),
  assessmentVersionId: ulidFk("assessment_version_id")
    .notNull()
    .references(() => assessmentVersions.id, { onDelete: "cascade" }),
  orderIndex: integer("order_index").notNull().default(0),
  type: assessmentQuestionTypeEnum("type").notNull(),
  prompt: text("prompt").notNull(),
  options: jsonb("options"),
  correctAnswer: text("correct_answer"),
  points: numeric("points", { precision: 7, scale: 2 }).notNull(),
  /** Question-pool randomization per spec §10 anti-cheating controls. */
  randomizeOrder: boolean("randomize_order").notNull().default(true),
  ...timestamps,
});

export const assessmentAttempts = pgTable("assessment_attempts", {
  id: ulidPk(),
  assessmentVersionId: ulidFk("assessment_version_id")
    .notNull()
    .references(() => assessmentVersions.id, { onDelete: "restrict" }),
  studentProfileId: ulidFk("student_profile_id")
    .notNull()
    .references(() => studentProfiles.id, { onDelete: "restrict" }),
  status: assessmentAttemptStatusEnum("status").notNull().default("in_progress"),
  startedAt: utcTimestamp("started_at").notNull().defaultNow(),
  submittedAt: utcTimestamp("submitted_at"),
  score: numeric("score", { precision: 7, scale: 2 }),
  maxScore: numeric("max_score", { precision: 7, scale: 2 }),
  proctorMode: proctorModeEnum("proctor_mode").notNull().default("none"),
  honorStatementAcceptedAt: utcTimestamp("honor_statement_accepted_at"),
  ...timestamps,
});

export const assessmentAnswers = pgTable("assessment_answers", {
  id: ulidPk(),
  attemptId: ulidFk("attempt_id")
    .notNull()
    .references(() => assessmentAttempts.id, { onDelete: "cascade" }),
  questionId: ulidFk("question_id")
    .notNull()
    .references(() => assessmentQuestions.id, { onDelete: "restrict" }),
  answerText: text("answer_text"),
  isCorrect: boolean("is_correct"),
  pointsAwarded: numeric("points_awarded", { precision: 7, scale: 2 }),
  timeSpentSeconds: integer("time_spent_seconds"),
  answerChangeCount: integer("answer_change_count").notNull().default(0),
  ...timestamps,
});

/** Append-only anti-cheating telemetry — evidence for tutor review, not an automated verdict (spec §10). */
export const assessmentEvents = pgTable("assessment_events", {
  id: ulidPk(),
  attemptId: ulidFk("attempt_id")
    .notNull()
    .references(() => assessmentAttempts.id, { onDelete: "cascade" }),
  eventType: assessmentEventTypeEnum("event_type").notNull(),
  occurredAt: utcTimestamp("occurred_at").notNull().defaultNow(),
  metadata: jsonb("metadata"),
  createdAt: timestamps.createdAt,
});

export const diagnosticReports = pgTable("diagnostic_reports", {
  id: ulidPk(),
  assessmentAttemptId: ulidFk("assessment_attempt_id")
    .notNull()
    .unique()
    .references(() => assessmentAttempts.id, { onDelete: "restrict" }),
  studentProfileId: ulidFk("student_profile_id")
    .notNull()
    .references(() => studentProfiles.id, { onDelete: "restrict" }),
  subjectId: ulidFk("subject_id").references(() => subjects.id, { onDelete: "restrict" }),
  summary: text("summary").notNull(),
  strengths: text("strengths"),
  gaps: text("gaps"),
  recommendedNextSteps: text("recommended_next_steps"),
  generatedByUserId: ulidFk("generated_by_user_id").references(() => users.id),
  generatedAt: utcTimestamp("generated_at").notNull().defaultNow(),
  createdAt: timestamps.createdAt,
});
