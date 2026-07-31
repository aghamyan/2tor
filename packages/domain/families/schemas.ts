import { z } from "zod";

const trimmedNullable = (maximum: number) =>
  z
    .string()
    .trim()
    .max(maximum)
    .nullable()
    .transform((value) => (value === "" ? null : value));

const ianaTimezoneSchema = z
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

export const parentProfileInputSchema = z
  .object({
    fullName: z.string().trim().min(1).max(120),
    phone: trimmedNullable(40),
    contentLanguagePreference: z.enum(["en", "hy"]).nullable(),
  })
  .strict();

const studentProfileShape = {
  preferredName: z.string().trim().min(1).max(80),
  gradeLevel: trimmedNullable(30),
  isAdultLearner: z.boolean(),
  usState: trimmedNullable(40),
  dobYearMonth: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .nullable(),
  ageBand: z.enum(["under-8", "8-10", "11-12", "13-15", "16-17"]).nullable(),
};

export const studentProfileInputSchema = z
  .object(studentProfileShape)
  .strict()
  .superRefine((value, context) => {
    if (!value.isAdultLearner && value.dobYearMonth === null && value.ageBand === null) {
      context.addIssue({
        code: "custom",
        path: ["ageBand"],
        message: "A month/year or age band is required for a minor student",
      });
    }
    if (value.dobYearMonth !== null && value.ageBand !== null) {
      context.addIssue({
        code: "custom",
        path: ["ageBand"],
        message: "Provide either month/year or age band, not both",
      });
    }
    if (value.isAdultLearner && (value.dobYearMonth !== null || value.ageBand !== null)) {
      context.addIssue({
        code: "custom",
        path: ["isAdultLearner"],
        message: "Adult learners do not need child age data",
      });
    }
  });

export const createStudentInputSchema = z
  .object({
    username: z
      .string()
      .trim()
      .toLowerCase()
      .min(4)
      .max(40)
      .regex(/^[a-z0-9][a-z0-9._-]*$/),
    primaryTimezone: ianaTimezoneSchema,
    locale: z.enum(["en", "hy"]),
    relationship: z.enum(["parent", "guardian"]),
    ...studentProfileShape,
  })
  .strict()
  .superRefine((value, context) => {
    if (!value.isAdultLearner && value.dobYearMonth === null && value.ageBand === null) {
      context.addIssue({
        code: "custom",
        path: ["ageBand"],
        message: "A month/year or age band is required for a minor student",
      });
    }
    if (value.dobYearMonth !== null && value.ageBand !== null) {
      context.addIssue({
        code: "custom",
        path: ["ageBand"],
        message: "Provide either month/year or age band, not both",
      });
    }
    if (value.isAdultLearner && (value.dobYearMonth !== null || value.ageBand !== null)) {
      context.addIssue({
        code: "custom",
        path: ["isAdultLearner"],
        message: "Adult learners do not need child age data",
      });
    }
  });

export const linkStudentInputSchema = z
  .object({
    parentProfileId: z.string().trim().min(1),
    studentProfileId: z.string().trim().min(1),
    relationship: z.enum(["parent", "guardian"]),
    isPrimary: z.boolean(),
    reason: z.string().trim().min(3).max(300),
  })
  .strict();

export const unlinkStudentInputSchema = z
  .object({
    parentProfileId: z.string().trim().min(1),
    studentProfileId: z.string().trim().min(1),
    reason: z.string().trim().min(3).max(300),
  })
  .strict();

export const interestsInputSchema = z
  .object({
    interests: z
      .array(z.string().trim().min(1).max(60))
      .max(12)
      .transform((values) => [...new Set(values)]),
    reason: z.string().trim().min(3).max(300),
  })
  .strict();

export const preferencesInputSchema = z
  .object({
    preferredLessonStyle: trimmedNullable(300),
    availabilityNotes: trimmedNullable(500),
    notes: trimmedNullable(800),
    reason: z.string().trim().min(3).max(300),
  })
  .strict();

export const familyListInputSchema = z
  .object({
    cursor: z.string().trim().min(1).nullable().default(null),
    limit: z.number().int().min(1).max(50).default(20),
  })
  .strict();

export type ParentProfileInput = z.infer<typeof parentProfileInputSchema>;
export type StudentProfileInput = z.infer<typeof studentProfileInputSchema>;
export type CreateStudentInput = z.infer<typeof createStudentInputSchema>;
export type LinkStudentInput = z.infer<typeof linkStudentInputSchema>;
export type UnlinkStudentInput = z.infer<typeof unlinkStudentInputSchema>;
export type InterestsInput = z.infer<typeof interestsInputSchema>;
export type PreferencesInput = z.infer<typeof preferencesInputSchema>;
