import { z } from "zod";

const identifier = z.string().trim().min(1).max(80);
const reason = z.string().trim().min(3).max(500);
const nullableIdentifier = identifier
  .nullable()
  .optional()
  .transform((value) => value ?? null);
const nullableText = (maximum: number) =>
  z
    .string()
    .trim()
    .max(maximum)
    .nullable()
    .optional()
    .transform((value) => value || null);

export const proposeAssignmentInputSchema = z
  .object({
    tutorProfileId: identifier,
    studentProfileId: identifier,
    subjectId: nullableIdentifier,
    startAt: z.coerce.date(),
    endAt: z.coerce
      .date()
      .nullable()
      .optional()
      .transform((value) => value ?? null),
    reason,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.endAt && value.endAt <= value.startAt) {
      context.addIssue({ code: "custom", path: ["endAt"], message: "End must be after start" });
    }
  });

export const tutorDecisionInputSchema = z
  .object({ decision: z.enum(["accept", "reject"]), reason })
  .strict();

export const endAssignmentInputSchema = z.object({ reason }).strict();

export const tutorChangeRequestInputSchema = z
  .object({
    studentProfileId: identifier,
    subjectId: nullableIdentifier,
    preferredTutorProfileId: nullableIdentifier,
    notes: nullableText(1200),
  })
  .strict();

export const matchingNoteInputSchema = z
  .object({
    assignmentRequestId: nullableIdentifier,
    tutorStudentAssignmentId: nullableIdentifier,
    note: z.string().trim().min(1).max(2000),
  })
  .strict()
  .superRefine((value, context) => {
    if ((value.assignmentRequestId ? 1 : 0) + (value.tutorStudentAssignmentId ? 1 : 0) !== 1) {
      context.addIssue({ code: "custom", message: "Attach a note to exactly one matching record" });
    }
  });

export type ProposeAssignmentInput = z.infer<typeof proposeAssignmentInputSchema>;
export type TutorDecisionInput = z.infer<typeof tutorDecisionInputSchema>;
export type EndAssignmentInput = z.infer<typeof endAssignmentInputSchema>;
export type TutorChangeRequestInput = z.infer<typeof tutorChangeRequestInputSchema>;
export type MatchingNoteInput = z.infer<typeof matchingNoteInputSchema>;
