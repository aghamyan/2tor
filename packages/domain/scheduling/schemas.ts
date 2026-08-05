import { z } from "zod";

import { WEEKDAYS } from "./recurrence";

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

const reasonSchema = z.string().trim().min(3).max(300);
const durationMinutesSchema = z.number().int().min(15).max(240);

export const recurrenceInputSchema = z
  .object({
    interval: z.number().int().min(1).max(12),
    byDay: z
      .array(z.enum(WEEKDAYS))
      .min(1)
      .max(7)
      .transform((days) => [...new Set(days)]),
    hour: z.number().int().min(0).max(23),
    minute: z.number().int().min(0).max(59),
    timezone: ianaTimezoneSchema,
  })
  .strict();

export const createOneTimeLessonInputSchema = z
  .object({
    tutorStudentAssignmentId: z.string().trim().min(1),
    subjectId: z.string().trim().min(1),
    scheduledStartAt: z.coerce.date(),
    durationMinutes: durationMinutesSchema,
    timezoneAtBooking: ianaTimezoneSchema,
    isTrial: z.boolean().default(false),
    additionalParticipantUserIds: z.array(z.string().trim().min(1)).max(8).default([]),
  })
  .strict();

export const createLessonSeriesInputSchema = z
  .object({
    tutorStudentAssignmentId: z.string().trim().min(1),
    subjectId: z.string().trim().min(1),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD"),
    endDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD")
      .nullable(),
    durationMinutes: durationMinutesSchema,
    recurrence: recurrenceInputSchema,
    additionalParticipantUserIds: z.array(z.string().trim().min(1)).max(8).default([]),
    /** How far ahead to materialize concrete `lessons` rows at creation time. The worker job extends this later. */
    materializeHorizonDays: z.number().int().min(7).max(180).default(60),
  })
  .strict();

export const rescheduleLessonInputSchema = z
  .object({
    newScheduledStartAt: z.coerce.date(),
    durationMinutes: durationMinutesSchema,
    reason: reasonSchema,
    scope: z
      .enum(["this_lesson", "this_and_future", "entire_series"])
      .default("this_lesson"),
  })
  .strict();

export const cancelLessonInputSchema = z
  .object({
    category: z.enum([
      "parent_request",
      "tutor_request",
      "admin_action",
      "technical_issue",
      "other",
    ]),
    reason: reasonSchema,
  })
  .strict();

export const recordNoShowInputSchema = z
  .object({
    party: z.enum(["student", "tutor"]),
    reason: reasonSchema,
  })
  .strict();

export const recordAttendanceInputSchema = z
  .object({
    studentProfileId: z.string().trim().min(1),
    status: z.enum(["present", "absent", "late", "excused"]),
    notes: z
      .string()
      .trim()
      .max(500)
      .nullable()
      .transform((value) => (value === "" ? null : value))
      .default(null),
  })
  .strict();

export const setZoomMeetingInputSchema = z
  .object({
    joinUrl: z.string().trim().url().max(500),
    passcode: z
      .string()
      .trim()
      .max(40)
      .nullable()
      .transform((value) => (value === "" ? null : value))
      .default(null),
    startUrl: z
      .string()
      .trim()
      .url()
      .max(500)
      .nullable()
      .transform((value) => (value === "" ? null : value))
      .default(null),
    zoomMeetingId: z
      .string()
      .trim()
      .max(100)
      .nullable()
      .transform((value) => (value === "" ? null : value))
      .default(null),
  })
  .strict();

// `z.input<>`, not `z.infer`/`z.output<>`: several schemas above have `.default(...)` fields, and
// callers (services.ts's public function signatures, and every web-layer caller after it) must be
// allowed to omit those fields, not forced to pass the post-default value explicitly.
export type RecurrenceInput = z.input<typeof recurrenceInputSchema>;
export type CreateOneTimeLessonInput = z.input<typeof createOneTimeLessonInputSchema>;
export type CreateLessonSeriesInput = z.input<typeof createLessonSeriesInputSchema>;
export type RescheduleLessonInput = z.input<typeof rescheduleLessonInputSchema>;
export type CancelLessonInput = z.input<typeof cancelLessonInputSchema>;
export type RecordNoShowInput = z.input<typeof recordNoShowInputSchema>;
export type RecordAttendanceInput = z.input<typeof recordAttendanceInputSchema>;
export type SetZoomMeetingInput = z.input<typeof setZoomMeetingInputSchema>;
