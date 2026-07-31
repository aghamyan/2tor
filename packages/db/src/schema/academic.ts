import {
  boolean,
  date,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  uniqueIndex,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { timestamps, ulidFk, ulidPk, utcTimestamp } from "./_common";
import { users } from "./identity";
import { studentProfiles } from "./families";
import { tutorProfiles } from "./tutors";
import { lessons } from "./scheduling";

/**
 * Academic domain: subjects/courses, learning plans (versioned per spec §15), skills tracking,
 * tutor notes, lesson feedback, and progress reviews. `subjects` is the shared reference table
 * every other domain (tutors, matching, scheduling, content, ...) hangs a subject FK off of.
 */

export const enrollmentStatusEnum = pgEnum("enrollment_status", ["active", "completed", "dropped"]);
export const learningPlanStatusEnum = pgEnum("learning_plan_status", [
  "draft",
  "active",
  "under_review",
  "completed",
  "archived",
]);
export const parentApprovalStatusEnum = pgEnum("parent_approval_status", [
  "not_required",
  "pending",
  "approved",
  "changes_requested",
]);
export const learningPlanItemTypeEnum = pgEnum("learning_plan_item_type", [
  "focus_area",
  "module_topic",
  "target_outcome",
]);
export const learningPlanItemStatusEnum = pgEnum("learning_plan_item_status", [
  "planned",
  "in_progress",
  "completed",
]);
export const goalSourceEnum = pgEnum("goal_source", ["parent", "student", "tutor"]);
export const goalStatusEnum = pgEnum("goal_status", ["active", "achieved", "abandoned"]);
export const skillLevelEnum = pgEnum("skill_level", [
  "needs_support",
  "developing",
  "proficient",
  "advanced",
]);
export const skillRecordSourceEnum = pgEnum("skill_record_source", [
  "tutor_observation",
  "assessment",
  "assignment",
]);
export const tutorNoteVisibilityEnum = pgEnum("tutor_note_visibility", [
  "parent_visible",
  "staff_only",
]);
export const feedbackObjectiveMetEnum = pgEnum("feedback_objective_met", ["yes", "partly", "no"]);
export const feedbackAssignmentCompletionEnum = pgEnum("feedback_assignment_completion", [
  "not_applicable",
  "complete",
  "partial",
  "incomplete",
]);
export const feedbackConfidenceEnum = pgEnum("feedback_confidence", ["low", "medium", "high"]);
export const feedbackStatusEnum = pgEnum("feedback_status", ["draft", "published", "revised"]);
export const progressTrendEnum = pgEnum("progress_trend", [
  "improving",
  "steady",
  "declining",
  "insufficient_data",
]);

export const subjects = pgTable("subjects", {
  id: ulidPk(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamps.createdAt,
});

export const courses = pgTable("courses", {
  id: ulidPk(),
  subjectId: ulidFk("subject_id")
    .notNull()
    .references(() => subjects.id, { onDelete: "restrict" }),
  title: text("title").notNull(),
  description: text("description"),
  level: text("level"),
  isGroup: boolean("is_group").notNull().default(false),
  ...timestamps,
});

export const enrollments = pgTable("enrollments", {
  id: ulidPk(),
  courseId: ulidFk("course_id")
    .notNull()
    .references(() => courses.id, { onDelete: "restrict" }),
  studentProfileId: ulidFk("student_profile_id")
    .notNull()
    .references(() => studentProfiles.id, { onDelete: "restrict" }),
  status: enrollmentStatusEnum("status").notNull().default("active"),
  enrolledAt: utcTimestamp("enrolled_at").notNull().defaultNow(),
  completedAt: utcTimestamp("completed_at"),
  ...timestamps,
});

export const curriculumFrameworks = pgTable("curriculum_frameworks", {
  id: ulidPk(),
  subjectId: ulidFk("subject_id")
    .notNull()
    .references(() => subjects.id, { onDelete: "restrict" }),
  name: text("name").notNull(),
  description: text("description"),
  gradeRangeMin: integer("grade_range_min"),
  gradeRangeMax: integer("grade_range_max"),
  source: text("source"),
  ...timestamps,
});

/**
 * The tutor owns day-to-day adjustment; major changes require parent visibility/acknowledgment
 * via `parent_approval_status` (spec §6.2). Full history lives in `learning_plan_versions`.
 */
export const learningPlans = pgTable("learning_plans", {
  id: ulidPk(),
  studentProfileId: ulidFk("student_profile_id")
    .notNull()
    .references(() => studentProfiles.id, { onDelete: "restrict" }),
  subjectId: ulidFk("subject_id")
    .notNull()
    .references(() => subjects.id, { onDelete: "restrict" }),
  title: text("title").notNull(),
  startDate: date("start_date").notNull(),
  reviewDate: date("review_date"),
  parentGoal: text("parent_goal"),
  studentGoal: text("student_goal"),
  tutorGoal: text("tutor_goal"),
  currentBaseline: text("current_baseline"),
  expectedLessonFrequency: text("expected_lesson_frequency"),
  homeworkExpectations: text("homework_expectations"),
  projectWork: text("project_work"),
  status: learningPlanStatusEnum("status").notNull().default("draft"),
  authorUserId: ulidFk("author_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  parentApprovalStatus: parentApprovalStatusEnum("parent_approval_status")
    .notNull()
    .default("not_required"),
  ...timestamps,
});

/** Append-only revision snapshots. `snapshot` holds the full plan state at that version. */
export const learningPlanVersions = pgTable(
  "learning_plan_versions",
  {
    id: ulidPk(),
    learningPlanId: ulidFk("learning_plan_id")
      .notNull()
      .references(() => learningPlans.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    snapshot: jsonb("snapshot").notNull(),
    changeSummary: text("change_summary"),
    createdByUserId: ulidFk("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamps.createdAt,
  },
  (table) => [
    uniqueIndex("learning_plan_versions_unique").on(table.learningPlanId, table.versionNumber),
  ],
);

export const learningPlanItems = pgTable("learning_plan_items", {
  id: ulidPk(),
  learningPlanId: ulidFk("learning_plan_id")
    .notNull()
    .references(() => learningPlans.id, { onDelete: "cascade" }),
  type: learningPlanItemTypeEnum("type").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  orderIndex: integer("order_index").notNull().default(0),
  status: learningPlanItemStatusEnum("status").notNull().default("planned"),
  ...timestamps,
});

export const goals = pgTable("goals", {
  id: ulidPk(),
  studentProfileId: ulidFk("student_profile_id")
    .notNull()
    .references(() => studentProfiles.id, { onDelete: "restrict" }),
  source: goalSourceEnum("source").notNull(),
  description: text("description").notNull(),
  targetDate: date("target_date"),
  status: goalStatusEnum("status").notNull().default("active"),
  ...timestamps,
});

export const skills = pgTable("skills", {
  id: ulidPk(),
  subjectId: ulidFk("subject_id").references(() => subjects.id, { onDelete: "restrict" }),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamps.createdAt,
});

export const studentSkillRecords = pgTable("student_skill_records", {
  id: ulidPk(),
  studentProfileId: ulidFk("student_profile_id")
    .notNull()
    .references(() => studentProfiles.id, { onDelete: "restrict" }),
  skillId: ulidFk("skill_id")
    .notNull()
    .references(() => skills.id, { onDelete: "restrict" }),
  level: skillLevelEnum("level").notNull(),
  lastAssessedAt: utcTimestamp("last_assessed_at"),
  source: skillRecordSourceEnum("source").notNull(),
  notes: text("notes"),
  ...timestamps,
});

/** `staff_only` notes are never surfaced to parents (spec §4.1 "Cannot: View internal tutor notes marked staff-only"). */
export const tutorNotes = pgTable("tutor_notes", {
  id: ulidPk(),
  tutorProfileId: ulidFk("tutor_profile_id")
    .notNull()
    .references(() => tutorProfiles.id, { onDelete: "restrict" }),
  studentProfileId: ulidFk("student_profile_id")
    .notNull()
    .references(() => studentProfiles.id, { onDelete: "restrict" }),
  lessonId: ulidFk("lesson_id").references(() => lessons.id, { onDelete: "restrict" }),
  visibility: tutorNoteVisibilityEnum("visibility").notNull().default("staff_only"),
  note: text("note").notNull(),
  ...timestamps,
});

/**
 * Human-written only in the MVP (spec §6.3). Versioned via `version` + `supersedes_feedback_id`
 * rather than a separate table, since §15 lists no `lesson_feedback_versions` table.
 */
export const lessonFeedback = pgTable(
  "lesson_feedback",
  {
    id: ulidPk(),
    lessonId: ulidFk("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "restrict" }),
    studentProfileId: ulidFk("student_profile_id")
      .notNull()
      .references(() => studentProfiles.id, { onDelete: "restrict" }),
    topicsCovered: text("topics_covered"),
    objectiveMet: feedbackObjectiveMetEnum("objective_met").notNull(),
    assignmentCompletionStatus: feedbackAssignmentCompletionEnum("assignment_completion_status")
      .notNull()
      .default("not_applicable"),
    assignmentAccuracyNote: text("assignment_accuracy_note"),
    /** Neutral, behavior-based wording only — never permanent labels (spec §6.3). */
    effortEngagementNote: text("effort_engagement_note").notNull(),
    strengthsDemonstrated: text("strengths_demonstrated"),
    skillsToImprove: text("skills_to_improve"),
    nextLessonFocus: text("next_lesson_focus"),
    assignedHomework: text("assigned_homework"),
    parentActionNeeded: text("parent_action_needed"),
    studentActionNeeded: text("student_action_needed"),
    milestoneProgressNote: text("milestone_progress_note"),
    tutorConfidence: feedbackConfidenceEnum("tutor_confidence").notNull().default("medium"),
    freeTextComment: text("free_text_comment"),
    version: integer("version").notNull().default(1),
    supersedesFeedbackId: ulidFk("supersedes_feedback_id").references(
      (): AnyPgColumn => lessonFeedback.id,
    ),
    status: feedbackStatusEnum("status").notNull().default("draft"),
    createdByUserId: ulidFk("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("lesson_feedback_unique").on(table.lessonId, table.studentProfileId, table.version),
  ],
);

/** "Progress trend," never a fabricated projected grade (spec §16.1). `evidenceNotes` is mandatory. */
export const progressReviews = pgTable("progress_reviews", {
  id: ulidPk(),
  studentProfileId: ulidFk("student_profile_id")
    .notNull()
    .references(() => studentProfiles.id, { onDelete: "restrict" }),
  subjectId: ulidFk("subject_id").references(() => subjects.id, { onDelete: "restrict" }),
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  summary: text("summary").notNull(),
  progressTrend: progressTrendEnum("progress_trend").notNull(),
  evidenceNotes: text("evidence_notes").notNull(),
  reviewedByUserId: ulidFk("reviewed_by_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  sharedWithParentAt: utcTimestamp("shared_with_parent_at"),
  ...timestamps,
});
