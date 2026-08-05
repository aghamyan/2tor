import { z } from "zod";

/** Offered in the settings UI as the parent-selectable pre-lesson reminder lead time. */
export const WHATSAPP_REMINDER_LEAD_MINUTES_OPTIONS = [15, 30, 60, 120, 1440] as const;

const reminderLeadMinutesSchema = z.union(
  WHATSAPP_REMINDER_LEAD_MINUTES_OPTIONS.map((minutes) => z.literal(minutes)) as [
    z.ZodLiteral<number>,
    z.ZodLiteral<number>,
    ...z.ZodLiteral<number>[],
  ],
);

export const updateGroupPreferencesInputSchema = z.object({
  studentProfileId: z.string().min(1, "studentProfileId is required"),
  isEnabled: z.boolean(),
  reminderLeadMinutes: reminderLeadMinutesSchema,
  includeChild: z.boolean(),
});

export type UpdateGroupPreferencesInput = z.input<typeof updateGroupPreferencesInputSchema>;
