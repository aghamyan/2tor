import { z } from "zod";

const identifier = z.string().trim().min(1).max(160);
const requiredText = (max: number) => z.string().trim().min(1).max(max);
const nullableIdentifier = identifier.nullable().default(null);
const optionalIdentifier = identifier.nullish();

export const discussionScopeSchema = z
  .object({
    courseId: nullableIdentifier,
    groupId: nullableIdentifier,
    subjectId: nullableIdentifier,
  })
  .strict()
  .superRefine((value, context) => {
    if (!value.courseId && !value.groupId && !value.subjectId) {
      context.addIssue({
        code: "custom",
        message: "Choose a course, group, or subject for this question.",
      });
    }
  });

export const discussionVisibilitySchema = z.enum([
  "private_support",
  "group_shared",
  "tutors_only",
  "community",
]);

export const discussionQuestionTypeSchema = z.enum([
  "concept_explanation",
  "homework_help",
  "check_my_solution",
  "alternative_method",
  "exam_preparation",
  "proof_review",
  "general_discussion",
]);

/**
 * Blocks placeholder titles ("Help", "Urgent question") that give reviewers nothing to scan. A
 * short title can still be descriptive ("Why does x^0 = 1?") — length alone isn't the signal, so
 * this also rejects titles that are *only* one of a small set of generic phrases.
 */
const VAGUE_TITLES = new Set([
  "help",
  "urgent",
  "solve this",
  "math question",
  "i do not understand",
  "i don't understand",
  "can someone help",
  "can someone help?",
  "question",
  "please help",
  "need help",
  "quick question",
]);
const titleSchema = z
  .string()
  .trim()
  .min(12, "Write a descriptive title so others can understand the question at a glance.")
  .max(240)
  .refine((value) => !VAGUE_TITLES.has(value.toLowerCase().replace(/[!.]+$/, "")), {
    message: "This title is too vague. Describe the specific concept or problem.",
  });

export const createQuestionSchema = discussionScopeSchema
  .extend({
    studentProfileId: identifier,
    title: titleSchema,
    body: requiredText(12_000),
    bodyFormat: z.literal("markdown").default("markdown"),
    topicId: nullableIdentifier,
    gradeLevel: z.string().trim().max(40).nullish(),
    questionType: discussionQuestionTypeSchema.default("general_discussion"),
    whatTried: z.string().trim().max(4_000).nullish(),
    visibility: discussionVisibilitySchema,
    relatedClassId: nullableIdentifier,
    tags: z.array(z.string().trim().min(1).max(40)).max(5).default([]),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.visibility === "group_shared" && !value.groupId) {
      context.addIssue({
        code: "custom",
        path: ["groupId"],
        message: "Shared questions must be scoped to a group.",
      });
    }
    if (value.questionType === "homework_help" && !value.whatTried?.trim()) {
      context.addIssue({
        code: "custom",
        path: ["whatTried"],
        message: "Describe what you've already tried before asking for homework help.",
      });
    }
  });
export type CreateQuestionInput = z.input<typeof createQuestionSchema>;

export const updateQuestionSchema = z
  .object({
    title: titleSchema.optional(),
    body: requiredText(12_000).optional(),
    subjectId: optionalIdentifier,
    topicId: optionalIdentifier,
    gradeLevel: z.string().trim().max(40).nullish(),
    courseId: optionalIdentifier,
    questionType: discussionQuestionTypeSchema.optional(),
    whatTried: z.string().trim().max(4_000).nullish(),
    visibility: discussionVisibilitySchema.optional(),
    relatedClassId: optionalIdentifier,
    tags: z.array(z.string().trim().min(1).max(40)).max(5).optional(),
    editReason: z.string().trim().max(500).nullish(),
  })
  .strict();
export type UpdateQuestionInput = z.input<typeof updateQuestionSchema>;

export const createAnswerSchema = z.object({ body: requiredText(12_000) }).strict();
export type CreateAnswerInput = z.input<typeof createAnswerSchema>;

export const updateAnswerSchema = z
  .object({ body: requiredText(12_000), editReason: z.string().trim().max(500).nullish() })
  .strict();
export type UpdateAnswerInput = z.input<typeof updateAnswerSchema>;

export const questionListSchema = discussionScopeSchema
  .extend({ limit: z.number().int().min(1).max(100).default(50) })
  .strict();
export type QuestionListInput = z.input<typeof questionListSchema>;

export const discussionFeedFilterSchema = z
  .object({
    search: z.string().trim().max(200).optional(),
    subjectId: identifier.optional(),
    topicId: identifier.optional(),
    courseId: identifier.optional(),
    gradeLevel: z.string().trim().max(40).optional(),
    questionType: discussionQuestionTypeSchema.optional(),
    status: z
      .enum([
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
      ])
      .optional(),
    tutorVerified: z.boolean().optional(),
    minTutorRating: z.number().min(1).max(5).optional(),
    tagSlug: z.string().trim().max(40).optional(),
    authorUserId: identifier.optional(),
    followedByUserId: identifier.optional(),
    savedByUserId: identifier.optional(),
    needsTutorReview: z.boolean().optional(),
    sort: z
      .enum([
        "recent_activity",
        "newest",
        "most_helpful",
        "most_answered",
        "unanswered",
        "highest_rated",
        "needs_tutor_review",
      ])
      .default("recent_activity"),
    cursor: z.string().nullish(),
    limit: z.number().int().min(1).max(50).default(20),
  })
  .strict();
export type DiscussionFeedFilterInput = z.input<typeof discussionFeedFilterSchema>;

export const verificationStatusSchema = z.enum([
  "correct",
  "mostly_correct",
  "correct_approach_arithmetic_error",
  "needs_revision",
  "incorrect",
  "incomplete_explanation",
]);
export const verifyAnswerSchema = z
  .object({
    verificationStatus: verificationStatusSchema,
    verificationNote: z.string().trim().max(1_000).nullish(),
  })
  .strict();
export type VerifyAnswerInput = z.input<typeof verifyAnswerSchema>;

export const requestRevisionSchema = z.object({ note: requiredText(1_000) }).strict();
export type RequestRevisionInput = z.input<typeof requestRevisionSchema>;

/**
 * "Wrong.", "Bad", "No" alone don't tell a student what to fix — this blocks feedback that is
 * *only* one of these short, non-constructive phrases once trimmed of punctuation. It does not
 * (and cannot) evaluate whether longer feedback is genuinely useful; that remains a human/tutor
 * judgment the UI and moderation queue support, not something regex should overreach into.
 */
const VAGUE_FEEDBACK = new Set([
  "wrong",
  "bad",
  "no",
  "incorrect",
  "nope",
  "not right",
  "this is wrong",
  "this is bad",
  "try again",
  "redo this",
]);
function isVagueFeedback(value: string): boolean {
  return VAGUE_FEEDBACK.has(
    value
      .trim()
      .toLowerCase()
      .replace(/[!.]+$/, ""),
  );
}
const MIN_LOW_RATING_FEEDBACK_LENGTH = 20;
const MAX_RATING_FEEDBACK_LENGTH = 500;

export const rateAnswerSchema = z
  .object({
    rating: z
      .number()
      .int()
      .min(1, "Rating must be at least 1.")
      .max(5, "Rating must be at most 5."),
    publicFeedback: z.string().trim().max(MAX_RATING_FEEDBACK_LENGTH).nullish(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.rating > 2) return;
    const feedback = value.publicFeedback?.trim() ?? "";
    if (feedback.length < MIN_LOW_RATING_FEEDBACK_LENGTH || isVagueFeedback(feedback)) {
      context.addIssue({
        code: "custom",
        path: ["publicFeedback"],
        message:
          "Ratings of 1–2 stars need constructive feedback explaining what to correct (at least " +
          `${MIN_LOW_RATING_FEEDBACK_LENGTH} characters, not just "wrong" or "bad").`,
      });
    }
  });
export type RateAnswerInput = z.input<typeof rateAnswerSchema>;

export const removeRatingSchema = z
  .object({ reason: z.string().trim().max(500).nullish() })
  .strict();
export type RemoveRatingInput = z.input<typeof removeRatingSchema>;

export const invalidateRatingSchema = z.object({ reason: requiredText(500) }).strict();
export type InvalidateRatingInput = z.input<typeof invalidateRatingSchema>;

export const createCommentSchema = z
  .object({
    questionId: identifier.nullish(),
    answerId: identifier.nullish(),
    parentCommentId: identifier.nullish(),
    body: requiredText(2_000),
  })
  .strict()
  .superRefine((value, context) => {
    if (Boolean(value.questionId) === Boolean(value.answerId)) {
      context.addIssue({
        code: "custom",
        message: "A comment must belong to exactly one question or answer.",
      });
    }
  });
export type CreateCommentInput = z.input<typeof createCommentSchema>;

export const updateCommentSchema = z.object({ body: requiredText(2_000) }).strict();
export type UpdateCommentInput = z.input<typeof updateCommentSchema>;

export const createCorrectionSchema = z
  .object({
    issueDescription: requiredText(1_000),
    proposedCorrection: requiredText(4_000),
    explanation: z.string().trim().max(2_000).nullish(),
  })
  .strict();
export type CreateCorrectionInput = z.input<typeof createCorrectionSchema>;

export const respondToCorrectionSchema = z
  .object({
    decision: z.enum(["accepted", "partially_accepted", "rejected"]),
    authorResponse: requiredText(1_000),
  })
  .strict();
export type RespondToCorrectionInput = z.input<typeof respondToCorrectionSchema>;

export const resolveCorrectionSchema = z.object({ resolutionNote: requiredText(1_000) }).strict();
export type ResolveCorrectionInput = z.input<typeof resolveCorrectionSchema>;

export const reportTargetTypeSchema = z.enum([
  "discussion_question",
  "discussion_answer",
  "discussion_comment",
]);
export const createReportSchema = z
  .object({
    targetType: reportTargetTypeSchema,
    targetId: identifier,
    reason: requiredText(200),
    details: z.string().trim().max(2_000).nullish(),
  })
  .strict();
export type CreateReportInput = z.input<typeof createReportSchema>;

export const resolveReportSchema = z
  .object({
    status: z.enum(["reviewing", "resolved", "dismissed", "escalated"]),
    severity: z.enum(["low", "medium", "high", "critical"]).nullish(),
    resolutionNote: requiredText(1_000),
  })
  .strict();
export type ResolveReportInput = z.input<typeof resolveReportSchema>;

export const closeQuestionSchema = z.object({ reason: requiredText(500) }).strict();
export type CloseQuestionInput = z.input<typeof closeQuestionSchema>;

export const markDuplicateSchema = z.object({ duplicateOfQuestionId: identifier }).strict();
export type MarkDuplicateInput = z.input<typeof markDuplicateSchema>;
