import { z } from "zod";

const id = z.string().trim().min(1).max(180);
const text = (max = 1_000) => z.string().trim().min(1).max(max);
const nullableText = (max = 4_000) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((value) => value || null);

export const pointEventSchema = z
  .object({
    studentProfileId: id,
    type: z.enum([
      "on_time_assignment",
      "improvement_over_prior_attempt",
      "thoughtful_question",
      "milestone_completed",
      "approved_peer_help",
      "project_completed",
      "attendance",
    ]),
    /** Stable source-event ID. Replaying the same source event is always a no-op. */
    referenceId: id,
    occurredAt: z.coerce.date(),
    createdByUserId: id.nullable().default(null),
  })
  .strict();

export const streakGracePeriodSchema = z
  .object({
    studentProfileId: id,
    type: z.enum(["attendance", "assignment_completion"]),
    /** The missed learning day, expressed in UTC by the source system. */
    date: z.string().date(),
    reason: z.enum(["illness", "travel", "approved_absence"]),
    referenceId: id,
    createdByUserId: id.nullable().default(null),
  })
  .strict();

export const competitionPreferenceSchema = z
  .object({ studentProfileId: id, enabled: z.boolean() })
  .strict();

export const challengeSchema = z
  .object({
    title: text(180),
    description: nullableText(2_000),
    subjectId: id.nullable(),
    startAt: z.coerce.date(),
    endAt: z.coerce.date(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.endAt <= value.startAt)
      context.addIssue({
        code: "custom",
        path: ["endAt"],
        message: "A challenge must end after it starts.",
      });
  });

export type PointEventInput = z.infer<typeof pointEventSchema>;
export type StreakGracePeriodInput = z.infer<typeof streakGracePeriodSchema>;
export type CompetitionPreferenceInput = z.infer<typeof competitionPreferenceSchema>;
export type ChallengeInput = z.infer<typeof challengeSchema>;
