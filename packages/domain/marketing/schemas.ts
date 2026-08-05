import { z } from "zod";

const optionalText = (maximum: number) =>
  z
    .string()
    .trim()
    .max(maximum)
    .optional()
    .transform((value) => value || null);

export const createMarketingLeadSchema = z
  .object({
    kind: z
      .enum([
        "consultation",
        "assessment",
        "contact",
        "tutor_application",
        "trial_class",
        "group_matching",
      ])
      .default("consultation"),
    parentName: z.string().trim().min(2).max(120),
    email: z.string().trim().email().max(254),
    phone: optionalText(40),
    learnerAgeBand: z
      .preprocess(
        (value) => (value === "" || value === undefined ? null : value),
        z.enum(["under_8", "8_10", "11_13", "14_17", "adult"]).nullable(),
      )
      .default(null),
    interest: optionalText(160),
    message: optionalText(1_000),
    locale: z.enum(["en", "hy"]).default("en"),
    privacyConsent: z.literal(true),
    // Honeypots must remain empty; bots are accepted with a neutral response by the route.
    company: z.string().max(0).optional().default(""),
  })
  .strict();

export type CreateMarketingLeadInput = z.input<typeof createMarketingLeadSchema>;
