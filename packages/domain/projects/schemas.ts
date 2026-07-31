import { z } from "zod";

const text = (max = 4_000) => z.string().trim().min(1).max(max);
const nullableText = (max = 4_000) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((value) => value || null);
const nullableId = z.string().trim().min(1).max(100).nullable();

export const createProjectSchema = z
  .object({
    courseId: nullableId,
    subjectId: text(100),
    title: text(240),
    description: nullableText(12_000),
    isGroup: z.boolean().default(false),
    status: z
      .enum(["planned", "in_progress", "submitted", "reviewed", "completed"])
      .default("planned"),
    startDate: z.string().date().nullable(),
    dueDate: z.string().date().nullable(),
    members: z
      .array(z.object({ studentProfileId: text(100), roleLabel: nullableText(120) }).strict())
      .min(1)
      .max(50),
  })
  .strict()
  .superRefine((value, context) => {
    if (!value.isGroup && value.members.length !== 1)
      context.addIssue({
        code: "custom",
        path: ["members"],
        message: "Individual projects need exactly one member.",
      });
    if (
      new Set(value.members.map((member) => member.studentProfileId)).size !== value.members.length
    )
      context.addIssue({
        code: "custom",
        path: ["members"],
        message: "A student can only be added once.",
      });
    if (value.startDate && value.dueDate && value.dueDate < value.startDate)
      context.addIssue({
        code: "custom",
        path: ["dueDate"],
        message: "Due date must not precede the start date.",
      });
  });

export const addProjectMemberSchema = z
  .object({ studentProfileId: text(100), roleLabel: nullableText(120) })
  .strict();
export const createProjectUpdateSchema = z
  .object({ note: text(12_000), progressPercentage: z.number().int().min(0).max(100).nullable() })
  .strict();
export const createProjectRubricSchema = z
  .object({ title: text(240), description: nullableText(4_000), subjectId: nullableId })
  .strict();
export const addPortfolioItemSchema = z
  .object({
    projectId: nullableId,
    title: text(240),
    description: nullableText(12_000),
    /** An external, already-public evidence URL only; private uploaded files are never public links. */
    linkUrl: z.string().url().max(2_000).nullable(),
  })
  .strict();

export const fileScanCallbackSchema = z
  .object({ status: z.enum(["clean", "infected", "error"]) })
  .strict();

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type AddProjectMemberInput = z.infer<typeof addProjectMemberSchema>;
export type CreateProjectUpdateInput = z.infer<typeof createProjectUpdateSchema>;
export type CreateProjectRubricInput = z.infer<typeof createProjectRubricSchema>;
export type AddPortfolioItemInput = z.infer<typeof addPortfolioItemSchema>;
