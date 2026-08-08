import { z } from "zod";
import { GRADE_LEVEL_OPTIONS } from "./models";

const requiredText = (max = 4_000) => z.string().trim().min(1).max(max);
const optionalText = (max = 4_000) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((value) => value || null);
const optionalId = z.string().trim().min(1).max(100).nullable();
export const createResourceSchema = z
  .object({
    title: requiredText(240),
    description: optionalText(12_000),
    subjectId: optionalId,
    type: z.enum(["document", "video", "link", "worksheet", "interactive"]),
    ownership: z.enum(["company", "tutor_created", "third_party_licensed"]),
    status: z.enum(["draft", "published"]).default("draft"),
    tags: z.array(requiredText(80)).max(20).default([]),
    links: z
      .array(z.object({ url: z.string().url().max(2_000), title: optionalText(500) }).strict())
      .max(5)
      .default([]),
    visibility: z.enum(["everyone", "grades", "students"]).default("everyone"),
    gradeLevels: z.array(z.enum(GRADE_LEVEL_OPTIONS)).max(GRADE_LEVEL_OPTIONS.length).default([]),
    studentProfileIds: z.array(requiredText(100)).max(200).default([]),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.type === "video" && value.links.length !== 1)
      context.addIssue({
        code: "custom",
        path: ["links"],
        message: "A video resource needs exactly one YouTube link.",
      });
    if (value.type === "link" && value.links.length !== 1)
      context.addIssue({
        code: "custom",
        path: ["links"],
        message: "A link resource needs exactly one URL.",
      });
    if (value.type !== "video" && value.type !== "link" && value.links.length > 0)
      context.addIssue({
        code: "custom",
        path: ["links"],
        message: "Only video or link resources may include external links.",
      });
    if (value.visibility === "grades" && value.gradeLevels.length === 0)
      context.addIssue({
        code: "custom",
        path: ["gradeLevels"],
        message: "Choose at least one grade level.",
      });
    if (value.visibility === "students" && value.studentProfileIds.length === 0)
      context.addIssue({
        code: "custom",
        path: ["studentProfileIds"],
        message: "Choose at least one student.",
      });
  });
export const assignResourceSchema = z
  .object({ resourceId: requiredText(100), studentProfileId: optionalId, courseId: optionalId })
  .strict()
  .superRefine((value, context) => {
    if (!value.studentProfileId && !value.courseId)
      context.addIssue({ code: "custom", message: "Choose a student or course." });
  });
export const bookmarkSchema = z.object({ resourceId: requiredText(100) }).strict();
export const reportContentSchema = z
  .object({ resourceId: requiredText(100), reason: requiredText(2_000) })
  .strict();
export const tutorUploadSchema = z
  .object({
    resourceId: optionalId,
    fileName: requiredText(255),
    mimeType: requiredText(150),
    sizeBytes: z
      .number()
      .int()
      .positive()
      .max(25 * 1024 * 1024),
    rightsConfirmed: z.boolean(),
  })
  .strict();
export type CreateResourceInput = z.input<typeof createResourceSchema>;
