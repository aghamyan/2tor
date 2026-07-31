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
import { timestamps, ulidFk, ulidPk, utcTimestamp, virusScanStatusEnum } from "./_common";
import { users } from "./identity";
import { studentProfiles } from "./families";
import { subjects } from "./academic";
import { lessons } from "./scheduling";
import { projects } from "./projects";

/** Assignments domain: tutor-created homework, submissions, grading, and reusable rubrics. */

export const assignmentPublishStatusEnum = pgEnum("assignment_publish_status", [
  "draft",
  "published",
  "closed",
]);
export const assignmentQuestionTypeEnum = pgEnum("assignment_question_type", [
  "short_answer",
  "multiple_choice",
  "file_upload",
  "essay",
  "code",
]);
export const submissionStatusEnum = pgEnum("submission_status", [
  "not_started",
  "in_progress",
  "submitted",
  "graded",
  "returned",
]);
export const rubricScopeEnum = pgEnum("rubric_scope", ["assignment", "project"]);

export const assignments = pgTable("assignments", {
  id: ulidPk(),
  createdByUserId: ulidFk("created_by_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  studentProfileId: ulidFk("student_profile_id")
    .notNull()
    .references(() => studentProfiles.id, { onDelete: "restrict" }),
  subjectId: ulidFk("subject_id").references(() => subjects.id, { onDelete: "restrict" }),
  lessonId: ulidFk("lesson_id").references(() => lessons.id, { onDelete: "restrict" }),
  title: text("title").notNull(),
  instructions: text("instructions"),
  dueAt: utcTimestamp("due_at"),
  status: assignmentPublishStatusEnum("status").notNull().default("draft"),
  maxScore: numeric("max_score", { precision: 7, scale: 2 }),
  ...timestamps,
});

export const assignmentQuestions = pgTable("assignment_questions", {
  id: ulidPk(),
  assignmentId: ulidFk("assignment_id")
    .notNull()
    .references(() => assignments.id, { onDelete: "cascade" }),
  orderIndex: integer("order_index").notNull().default(0),
  type: assignmentQuestionTypeEnum("type").notNull(),
  prompt: text("prompt").notNull(),
  /** Multiple-choice option list, e.g. [{ key: "a", label: "..." }]. */
  options: jsonb("options"),
  correctAnswer: text("correct_answer"),
  points: numeric("points", { precision: 7, scale: 2 }),
  ...timestamps,
});

export const assignmentSubmissions = pgTable(
  "assignment_submissions",
  {
    id: ulidPk(),
    assignmentId: ulidFk("assignment_id")
      .notNull()
      .references(() => assignments.id, { onDelete: "restrict" }),
    studentProfileId: ulidFk("student_profile_id")
      .notNull()
      .references(() => studentProfiles.id, { onDelete: "restrict" }),
    status: submissionStatusEnum("status").notNull().default("not_started"),
    attemptNumber: integer("attempt_number").notNull().default(1),
    submittedAt: utcTimestamp("submitted_at"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("assignment_submissions_unique").on(
      table.assignmentId,
      table.studentProfileId,
      table.attemptNumber,
    ),
  ],
);

export const submissionAnswers = pgTable("submission_answers", {
  id: ulidPk(),
  submissionId: ulidFk("submission_id")
    .notNull()
    .references(() => assignmentSubmissions.id, { onDelete: "cascade" }),
  questionId: ulidFk("question_id")
    .notNull()
    .references(() => assignmentQuestions.id, { onDelete: "restrict" }),
  answerText: text("answer_text"),
  selectedOptionKey: text("selected_option_key"),
  isCorrect: boolean("is_correct"),
  pointsAwarded: numeric("points_awarded", { precision: 7, scale: 2 }),
  ...timestamps,
});

export const submissionFiles = pgTable("submission_files", {
  id: ulidPk(),
  submissionId: ulidFk("submission_id")
    .notNull()
    .references(() => assignmentSubmissions.id, { onDelete: "cascade" }),
  fileKey: text("file_key").notNull(),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  virusScanStatus: virusScanStatusEnum("virus_scan_status").notNull().default("pending"),
  uploadedAt: utcTimestamp("uploaded_at").notNull().defaultNow(),
});

export const gradingRecords = pgTable("grading_records", {
  id: ulidPk(),
  submissionId: ulidFk("submission_id")
    .notNull()
    .unique()
    .references(() => assignmentSubmissions.id, { onDelete: "cascade" }),
  gradedByUserId: ulidFk("graded_by_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  score: numeric("score", { precision: 7, scale: 2 }),
  maxScore: numeric("max_score", { precision: 7, scale: 2 }),
  feedback: text("feedback"),
  gradedAt: utcTimestamp("graded_at").notNull(),
  ...timestamps,
});

export const rubrics = pgTable("rubrics", {
  id: ulidPk(),
  title: text("title").notNull(),
  description: text("description"),
  createdByUserId: ulidFk("created_by_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  subjectId: ulidFk("subject_id").references(() => subjects.id, { onDelete: "restrict" }),
  scope: rubricScopeEnum("scope").notNull(),
  ...timestamps,
});

/** Exactly one of `submission_id`/`project_id` is set — enforced at the app layer, not here. */
export const rubricScores = pgTable("rubric_scores", {
  id: ulidPk(),
  rubricId: ulidFk("rubric_id")
    .notNull()
    .references(() => rubrics.id, { onDelete: "restrict" }),
  submissionId: ulidFk("submission_id").references(() => assignmentSubmissions.id, {
    onDelete: "restrict",
  }),
  projectId: ulidFk("project_id").references(() => projects.id, { onDelete: "restrict" }),
  criterionKey: text("criterion_key").notNull(),
  criterionLabel: text("criterion_label").notNull(),
  scoreValue: numeric("score_value", { precision: 7, scale: 2 }).notNull(),
  maxValue: numeric("max_value", { precision: 7, scale: 2 }).notNull(),
  comments: text("comments"),
  scoredByUserId: ulidFk("scored_by_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  scoredAt: utcTimestamp("scored_at").notNull().defaultNow(),
  createdAt: timestamps.createdAt,
});
