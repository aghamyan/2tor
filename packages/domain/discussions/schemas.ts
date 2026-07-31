import { z } from "zod";

const identifier = z.string().trim().min(1).max(160);
const requiredText = (max: number) => z.string().trim().min(1).max(max);
const nullableIdentifier = identifier.nullable().default(null);

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

export const createQuestionSchema = discussionScopeSchema
  .extend({
    studentProfileId: identifier,
    title: requiredText(240),
    body: requiredText(12_000),
    visibility: z.enum(["private_support", "group_shared"]),
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
  });

export const createAnswerSchema = z.object({ body: requiredText(12_000) }).strict();
export const questionListSchema = discussionScopeSchema
  .extend({ limit: z.number().int().min(1).max(100).default(50) })
  .strict();

export type CreateQuestionInput = z.input<typeof createQuestionSchema>;
export type CreateAnswerInput = z.input<typeof createAnswerSchema>;
export type QuestionListInput = z.input<typeof questionListSchema>;
