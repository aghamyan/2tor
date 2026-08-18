import { z } from "zod";

const nullableText = (maximum: number) =>
  z
    .string()
    .trim()
    .max(maximum)
    .nullable()
    .transform((value) => value || null);

export const ianaTimezoneSchema = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .refine(
    (value) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: value }).format();
        return true;
      } catch {
        return false;
      }
    },
    { message: "Invalid IANA time zone" },
  );

export const tutorProfileInputSchema = z
  .object({
    publicDisplayName: z.string().trim().min(1).max(120),
    bio: nullableText(4_000),
    headline: nullableText(180),
    country: nullableText(80),
    yearsExperience: z.number().int().min(0).max(80).nullable(),
    educationSummary: nullableText(2_000),
  })
  .strict();

/** Clearable, unlike `scheduling/schemas.ts`'s per-lesson `setZoomMeetingInputSchema.joinUrl` (which
 * is always required): a tutor removing their default shouldn't be forced to paste a placeholder
 * URL, so "" and `null` both mean "no default set" rather than a validation error. */
export const tutorZoomDefaultsInputSchema = z
  .object({
    defaultZoomJoinUrl: z
      .string()
      .trim()
      .max(500)
      .nullable()
      .transform((value) => (value === "" ? null : value))
      .refine((value) => value === null || z.string().url().safeParse(value).success, {
        message: "Enter a valid Zoom join URL",
      }),
    defaultZoomPasscode: z
      .string()
      .trim()
      .max(40)
      .nullable()
      .transform((value) => (value === "" ? null : value)),
  })
  .strict();

const gradeRangeSchema = z
  .object({
    minGrade: z.number().int().min(-2).max(20).nullable(),
    maxGrade: z.number().int().min(-2).max(20).nullable(),
    includesAdult: z.boolean(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.minGrade !== null && value.maxGrade !== null && value.minGrade > value.maxGrade) {
      context.addIssue({
        code: "custom",
        path: ["maxGrade"],
        message: "Maximum grade must not precede minimum grade",
      });
    }
  });

export const tutorCapabilitiesInputSchema = z
  .object({
    subjects: z
      .array(z.object({ subjectId: z.string().trim().min(1), isPrimary: z.boolean() }).strict())
      .min(1)
      .max(20)
      .superRefine((items, context) => {
        if (new Set(items.map((item) => item.subjectId)).size !== items.length)
          context.addIssue({ code: "custom", message: "Subjects must be unique" });
        if (items.filter((item) => item.isPrimary).length > 1)
          context.addIssue({ code: "custom", message: "Only one subject can be primary" });
      }),
    gradeRanges: z.array(gradeRangeSchema).max(12),
    languages: z
      .array(
        z
          .object({
            languageCode: z
              .string()
              .trim()
              .toLowerCase()
              .regex(/^[a-z]{2,3}$/),
            proficiency: z.enum(["native", "fluent", "conversational"]),
          })
          .strict(),
      )
      .min(1)
      .max(12)
      .superRefine((items, context) => {
        if (new Set(items.map((item) => item.languageCode)).size !== items.length)
          context.addIssue({ code: "custom", message: "Languages must be unique" });
      }),
  })
  .strict();

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const availabilityRuleSchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    startMinute: z.number().int().min(0).max(1_439),
    endMinute: z.number().int().min(1).max(1_440),
    effectiveFrom: isoDateSchema.nullable(),
    effectiveTo: isoDateSchema.nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.endMinute <= value.startMinute)
      context.addIssue({ code: "custom", path: ["endMinute"], message: "End must be after start" });
    if (value.effectiveFrom && value.effectiveTo && value.effectiveFrom > value.effectiveTo)
      context.addIssue({
        code: "custom",
        path: ["effectiveTo"],
        message: "Effective end must not precede start",
      });
  });

export const replaceAvailabilityInputSchema = z
  .object({
    timeZone: ianaTimezoneSchema,
    recurring: z.array(availabilityRuleSchema).max(42),
  })
  .strict();

export const availabilityQuerySchema = z
  .object({
    startAt: z.coerce.date(),
    endAt: z.coerce.date(),
  })
  .strict()
  .superRefine((value, context) => {
    const days = (value.endAt.getTime() - value.startAt.getTime()) / 86_400_000;
    if (value.endAt <= value.startAt || days > 92)
      context.addIssue({
        code: "custom",
        path: ["endAt"],
        message: "Use a positive window of at most 92 days",
      });
  });

export const documentUploadInputSchema = z
  .object({
    type: z.enum(["identity", "education", "certification", "background_check", "other"]),
    fileName: z.string().trim().min(1).max(160),
    mimeType: z.enum(["application/pdf", "image/jpeg", "image/png"]),
    sizeBytes: z
      .number()
      .int()
      .positive()
      .max(10 * 1024 * 1024),
  })
  .strict();

export const verificationReviewInputSchema = z
  .object({
    status: z.enum(["passed", "failed", "waived"]),
    evidenceRef: nullableText(500),
    expiresAt: z.coerce.date().nullable(),
    notes: nullableText(2_000),
  })
  .strict();

export type TutorProfileInput = z.infer<typeof tutorProfileInputSchema>;
export type TutorZoomDefaultsInput = z.infer<typeof tutorZoomDefaultsInputSchema>;
export type TutorCapabilitiesInput = z.infer<typeof tutorCapabilitiesInputSchema>;
export type ReplaceAvailabilityInput = z.infer<typeof replaceAvailabilityInputSchema>;
export type AvailabilityQueryInput = z.infer<typeof availabilityQuerySchema>;
export type DocumentUploadInput = z.infer<typeof documentUploadInputSchema>;
export type VerificationReviewInput = z.infer<typeof verificationReviewInputSchema>;
