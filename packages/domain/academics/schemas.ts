import { z } from "zod";

const requiredText = (max = 4_000) => z.string().trim().min(1).max(max);
const nullableText = (max = 4_000) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((value) => value || null);

export const learningPlanItemSchema = z
  .object({
    type: z.enum(["focus_area", "module_topic", "target_outcome"]),
    title: requiredText(180),
    description: nullableText(1_000),
    orderIndex: z.number().int().min(0).max(500),
    status: z.enum(["planned", "in_progress", "completed"]),
    isExamGoal: z.boolean().default(false),
  })
  .strict();

export const learningPlanSnapshotSchema = z
  .object({
    title: requiredText(180),
    startDate: z.string().date(),
    reviewDate: z.string().date().nullable(),
    mainGoal: requiredText(1_000),
    parentGoal: nullableText(1_000),
    studentGoal: nullableText(1_000),
    tutorGoal: nullableText(1_000),
    currentBaseline: nullableText(2_000),
    expectedLessonFrequency: nullableText(240),
    homeworkExpectations: nullableText(2_000),
    projectWork: nullableText(2_000),
    items: z.array(learningPlanItemSchema).min(1).max(100),
  })
  .strict();

export const createLearningPlanSchema = z
  .object({
    studentProfileId: requiredText(100),
    subjectId: requiredText(100),
    snapshot: learningPlanSnapshotSchema,
  })
  .strict();

export const reviseLearningPlanSchema = z
  .object({
    snapshot: learningPlanSnapshotSchema,
    changeSummary: requiredText(1_000),
  })
  .strict();

/** All parent/student-visible structured fields are required. "None" is a valid explicit value. */
export const lessonFeedbackSchema = z
  .object({
    lessonId: requiredText(100),
    studentProfileId: requiredText(100),
    topicsCovered: requiredText(),
    objectiveMet: z.enum(["yes", "partly", "no"]),
    assignmentCompletionStatus: z.enum(["not_applicable", "complete", "partial", "incomplete"]),
    assignmentAccuracyNote: nullableText(),
    effortEngagementNote: requiredText(),
    strengthsDemonstrated: requiredText(),
    skillsToImprove: requiredText(),
    nextLessonFocus: requiredText(),
    assignedHomework: requiredText(),
    parentActionNeeded: requiredText(),
    studentActionNeeded: requiredText(),
    milestoneProgressNote: requiredText(),
    tutorConfidence: z.enum(["low", "medium", "high"]),
    freeTextComment: requiredText(),
    staffOnlyNote: nullableText(),
    /** Defaults preserve the pre-existing behavior of every recap being visible to both. */
    visibleToParent: z.boolean().default(true),
    visibleToStudent: z.boolean().default(true),
    status: z.enum(["draft", "published"]).default("published"),
  })
  .strict()
  .superRefine((value, context) => {
    // Guard against fixed negative labels; feedback must describe observed lesson behavior.
    if (/\b(lazy|unmotivated|bad student|incapable)\b/i.test(value.effortEngagementNote)) {
      context.addIssue({
        code: "custom",
        path: ["effortEngagementNote"],
        message: "Use neutral, observed engagement wording.",
      });
    }
  });

export const milestoneSchema = z
  .object({
    studentProfileId: requiredText(100),
    subjectId: z.string().trim().min(1).max(100).nullable(),
    learningPlanId: z.string().trim().min(1).max(100).nullable(),
    category: z.enum([
      "academic_mastery",
      "assignment_consistency",
      "attendance_consistency",
      "independent_problem_solving",
      "project_completion",
      "communication_presentation",
      "exam_readiness",
      "armenian_reading",
      "armenian_speaking",
      "programming_project",
      "personal_confidence",
      "other",
    ]),
    objective: requiredText(1_000),
    baseline: nullableText(1_000),
    target: requiredText(1_000),
    targetDate: z.string().date().nullable(),
  })
  .strict();

export const milestoneEvidenceSchema = z
  .object({
    evidenceType: z.enum([
      "assignment_result",
      "project_rubric",
      "tutor_observation",
      "assessment",
      "file",
    ]),
    referenceId: z.string().trim().min(1).max(160).nullable(),
    fileKey: z.string().trim().min(1).max(500).nullable(),
    description: requiredText(2_000),
  })
  .strict()
  .superRefine((value, context) => {
    if (!value.referenceId && !value.fileKey)
      context.addIssue({ code: "custom", message: "Evidence needs a source reference or file." });
  });

export const progressReviewSchema = z
  .object({
    studentProfileId: requiredText(100),
    subjectId: z.string().trim().min(1).max(100).nullable(),
    periodStart: z.string().date(),
    periodEnd: z.string().date(),
    summary: requiredText(4_000),
    progressTrend: z.enum(["improving", "steady", "declining", "insufficient_data"]),
    evidenceNotes: requiredText(4_000),
    shareWithParent: z.boolean().default(false),
  })
  .strict();

const skillMasteryStatusValues = [
  "mastered",
  "secure",
  "developing",
  "needs_attention",
  "not_demonstrated",
  "not_assessed",
  "in_progress",
  "upcoming",
] as const;

const skillAssessmentEntrySchema = z
  .object({
    skillId: requiredText(100),
    score: z.number().min(0).max(10).multipleOf(0.1).nullable().default(null),
    status: z.enum(skillMasteryStatusValues),
    confidence: z.enum(["low", "medium", "high"]).nullable().default(null),
    note: nullableText(2_000),
  })
  .strict();

/** Backs the tutor "class review" bulk-recording flow — one shared context, several topic entries. */
export const recordSkillAssessmentsSchema = z
  .object({
    studentProfileId: requiredText(100),
    lessonId: z.string().trim().min(1).max(100).nullable().default(null),
    sharedNote: nullableText(2_000),
    evidenceType: z.enum([
      "tutor_observation",
      "homework",
      "lesson_activity",
      "diagnostic",
      "assessment",
    ]),
    visibleToParent: z.boolean().default(true),
    visibleToStudent: z.boolean().default(true),
    entries: z.array(skillAssessmentEntrySchema).min(1).max(50),
  })
  .strict();

export const createCustomSkillSchema = z
  .object({
    subjectId: requiredText(100),
    name: requiredText(180),
    description: nullableText(1_000),
  })
  .strict();

export type CreateLearningPlanInput = z.infer<typeof createLearningPlanSchema>;
export type ReviseLearningPlanInput = z.infer<typeof reviseLearningPlanSchema>;
export type LessonFeedbackInput = z.infer<typeof lessonFeedbackSchema>;
export type MilestoneInput = z.infer<typeof milestoneSchema>;
export type MilestoneEvidenceInput = z.infer<typeof milestoneEvidenceSchema>;
export type ProgressReviewInput = z.infer<typeof progressReviewSchema>;
export type RecordSkillAssessmentsInput = z.infer<typeof recordSkillAssessmentsSchema>;
export type CreateCustomSkillInput = z.infer<typeof createCustomSkillSchema>;
