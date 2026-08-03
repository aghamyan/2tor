import { z } from "zod";

const requiredText = (max = 4_000) => z.string().trim().min(1).max(max);
const nullableText = (max = 4_000) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((value) => value || null);
const nullableId = z.string().trim().min(1).max(100).nullable();

export const assignmentQuestionSchema = z
  .object({
    type: z.enum(["short_answer", "multiple_choice", "file_upload", "essay", "code"]),
    prompt: requiredText(8_000),
    options: z
      .array(z.object({ key: requiredText(80), label: requiredText(500) }).strict())
      .min(2)
      .max(20)
      .nullable(),
    points: z.number().finite().min(0).max(10_000).nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.type === "multiple_choice" && !value.options)
      context.addIssue({
        code: "custom",
        path: ["options"],
        message: "Multiple-choice questions require options.",
      });
    if (value.type !== "multiple_choice" && value.options)
      context.addIssue({
        code: "custom",
        path: ["options"],
        message: "Only multiple-choice questions may have options.",
      });
  });

export const createAssignmentSchema = z
  .object({
    studentProfileId: requiredText(100),
    subjectId: nullableId,
    lessonId: nullableId,
    title: requiredText(240),
    instructions: nullableText(12_000),
    dueAt: z.string().datetime().nullable(),
    status: z.enum(["draft", "published"]).default("draft"),
    maxScore: z.number().finite().min(0).max(100_000).nullable(),
    questions: z.array(assignmentQuestionSchema).min(1).max(100),
  })
  .strict();

export const submissionAnswersSchema = z
  .object({
    answers: z
      .array(
        z
          .object({
            questionId: requiredText(100),
            answerText: nullableText(20_000),
            selectedOptionKey: z.string().trim().max(80).nullable(),
          })
          .strict(),
      )
      .max(100),
    submit: z.boolean().default(false),
  })
  .strict();

export const gradeSubmissionSchema = z
  .object({
    score: z.number().finite().min(0).max(100_000).nullable(),
    maxScore: z.number().finite().min(0).max(100_000).nullable(),
    feedback: nullableText(12_000),
    rubricScores: z
      .array(
        z
          .object({
            rubricId: requiredText(100),
            criterionKey: requiredText(100),
            criterionLabel: requiredText(500),
            scoreValue: z.number().finite().min(0).max(100_000),
            maxValue: z.number().finite().positive().max(100_000),
            comments: nullableText(4_000),
          })
          .strict(),
      )
      .max(100),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.score !== null && value.maxScore !== null && value.score > value.maxScore)
      context.addIssue({
        code: "custom",
        path: ["score"],
        message: "Score cannot exceed the maximum score.",
      });
    value.rubricScores.forEach((score, index) => {
      if (score.scoreValue > score.maxValue)
        context.addIssue({
          code: "custom",
          path: ["rubricScores", index, "scoreValue"],
          message: "Criterion score cannot exceed its maximum.",
        });
    });
  });

export const setAssignmentStatusSchema = z
  .object({ status: z.enum(["published", "closed"]) })
  .strict();

export const createRubricSchema = z
  .object({
    title: requiredText(240),
    description: nullableText(4_000),
    subjectId: nullableId,
    scope: z.literal("assignment"),
  })
  .strict();
export const fileScanCallbackSchema = z
  .object({ status: z.enum(["clean", "infected", "error"]) })
  .strict();

export const assignmentListQuerySchema = z
  .object({
    cursor: z.string().trim().min(1).max(100).nullable().default(null),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    status: z.enum(["draft", "published", "closed"]).optional(),
    studentProfileId: z.string().trim().min(1).max(100).optional(),
    subjectId: z.string().trim().min(1).max(100).optional(),
  })
  .strict();

/** The pre-validation shape callers pass in — URL search params and `searchParams` props are always strings. `assignmentListQuerySchema` coerces/validates from here. */
export interface AssignmentListRawInput {
  cursor?: string | null;
  limit?: string | number | null;
  status?: string | null;
  studentProfileId?: string | null;
  subjectId?: string | null;
}

export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>;
export type SubmissionAnswersInput = z.infer<typeof submissionAnswersSchema>;
export type GradeSubmissionInput = z.infer<typeof gradeSubmissionSchema>;
export type CreateRubricInput = z.infer<typeof createRubricSchema>;
export type SetAssignmentStatusInput = z.infer<typeof setAssignmentStatusSchema>;
export type AssignmentListQuery = z.infer<typeof assignmentListQuerySchema>;
