import { z } from "zod";

export const conversationMemberInputSchema = z.object({
  userId: z.string().trim().min(1).max(64),
  role: z.enum(["parent", "student", "tutor", "staff"]),
});

export const createConversationSchema = z
  .object({
    type: z.enum(["parent_tutor", "group_lesson", "support", "discussion_thread"]),
    title: z.string().trim().min(1).max(160).nullable().default(null),
    members: z.array(conversationMemberInputSchema).min(2).max(30),
  })
  .superRefine((value, context) => {
    const seen = new Set<string>();
    value.members.forEach((member, index) => {
      if (seen.has(member.userId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "A user can only be added to a conversation once.",
          path: ["members", index, "userId"],
        });
      }
      seen.add(member.userId);
    });
  });

export const conversationListSchema = z.object({
  cursor: z.string().trim().min(1).nullable().default(null),
  limit: z.coerce.number().int().min(1).max(50).default(25),
});

export const messageListSchema = z.object({
  cursor: z.string().trim().min(1).nullable().default(null),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const sendMessageSchema = z.object({
  body: z.string().trim().min(1).max(10_000),
});

export const markReadSchema = z.object({
  messageId: z.string().trim().min(1).max(64),
});

export const staffAccessReasonSchema = z.string().trim().min(10).max(500);

export const reportMessageSchema = z.object({
  messageId: z.string().trim().min(1).max(64),
  reason: z.string().trim().min(10).max(1_000),
});

export type CreateConversationInput = z.input<typeof createConversationSchema>;
export type SendMessageInput = z.input<typeof sendMessageSchema>;
export type ReportMessageInput = z.input<typeof reportMessageSchema>;
