import { z } from "zod";

const text = (max: number) => z.string().trim().min(1).max(max);

export const supportCategorySchema = z.enum([
  "account",
  "scheduling",
  "lesson",
  "tutor",
  "academic",
  "payment",
  "technical",
  "privacy",
  "safety",
  "content",
]);
export const supportPrioritySchema = z.enum(["low", "normal", "high", "urgent"]);
export const supportTicketStatusSchema = z.enum([
  "open",
  "in_progress",
  "waiting_on_customer",
  "resolved",
  "closed",
]);

export const createSupportTicketSchema = z
  .object({
    subject: text(240),
    description: text(12_000),
    category: supportCategorySchema,
    priority: supportPrioritySchema.default("normal"),
    urgency: z.enum(["standard", "lesson_starting_now"]).default("standard"),
    /** Only applicable to account-recovery work. Either option needs a recent step-up challenge. */
    sensitiveChange: z.enum(["billing", "parent_relationship"]).nullable().default(null),
    source: z
      .object({ type: text(100), id: z.string().trim().min(1).max(160).nullable() })
      .strict()
      .nullable()
      .default(null),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.sensitiveChange && value.category !== "account") {
      context.addIssue({
        code: "custom",
        path: ["sensitiveChange"],
        message: "Sensitive recovery changes must use the account category.",
      });
    }
  });

export const addSupportCommentSchema = z
  .object({ body: text(12_000), isInternal: z.boolean().default(false) })
  .strict();
export const updateSupportTicketSchema = z
  .object({
    status: supportTicketStatusSchema.optional(),
    assignedToUserId: z.string().trim().min(1).max(100).nullable().optional(),
  })
  .strict()
  .refine(
    (value) => value.status !== undefined || value.assignedToUserId !== undefined,
    "Provide a status or assignment.",
  );
export const incidentActionSchema = z
  .object({
    action: text(1_000),
    notes: z
      .string()
      .trim()
      .max(8_000)
      .nullable()
      .transform((value) => value || null),
    status: z.enum(["open", "investigating", "resolved", "closed"]).optional(),
  })
  .strict();
export const parentOwnershipReviewSchema = z.object({ review: text(8_000) }).strict();

export type CreateSupportTicketInput = z.infer<typeof createSupportTicketSchema>;
export type AddSupportCommentInput = z.infer<typeof addSupportCommentSchema>;
export type UpdateSupportTicketInput = z.infer<typeof updateSupportTicketSchema>;
export type IncidentActionInput = z.infer<typeof incidentActionSchema>;
export type ParentOwnershipReviewInput = z.infer<typeof parentOwnershipReviewSchema>;
