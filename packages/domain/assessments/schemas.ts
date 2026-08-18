import { z } from "zod";

const requiredText = (max = 4_000) => z.string().trim().min(1).max(max);
const nullableText = (max = 4_000) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((value) => value || null);

const randomValueSchema = z
  .object({
    name: z
      .string()
      .trim()
      .regex(/^[A-Za-z][A-Za-z0-9_]{0,39}$/),
    min: z.number().finite().min(-1_000_000).max(1_000_000),
    max: z.number().finite().min(-1_000_000).max(1_000_000),
    step: z.number().finite().positive().max(1_000_000),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.max < value.min) {
      context.addIssue({
        code: "custom",
        path: ["max"],
        message: "Maximum must be at least the minimum.",
      });
    }
  });

export const assessmentQuestionInputSchema = z
  .object({
    type: z.enum(["multiple_choice", "short_answer", "numeric", "essay", "code"]),
    prompt: requiredText(12_000),
    choices: z
      .array(z.object({ key: requiredText(80), label: requiredText(1_000) }).strict())
      .min(2)
      .max(20)
      .nullable(),
    correctAnswer: nullableText(20_000),
    points: z.number().finite().positive().max(10_000),
    poolId: z.string().trim().min(1).max(100).nullable(),
    randomizeOptions: z.boolean().default(false),
    randomValues: z.array(randomValueSchema).max(20).default([]),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.type === "multiple_choice" && value.choices === null) {
      context.addIssue({
        code: "custom",
        path: ["choices"],
        message: "Multiple-choice questions require choices.",
      });
    }
    if (value.type !== "multiple_choice" && value.choices !== null) {
      context.addIssue({
        code: "custom",
        path: ["choices"],
        message: "Only multiple-choice questions may have choices.",
      });
    }
    for (const valueRule of value.randomValues) {
      if (!value.prompt.includes(`{{${valueRule.name}}}`)) {
        context.addIssue({
          code: "custom",
          path: ["randomValues"],
          message: `Prompt does not contain {{${valueRule.name}}}.`,
        });
      }
    }
  });

const audienceSchema = z
  .discriminatedUnion("mode", [
    z.object({ mode: z.literal("everyone") }).strict(),
    z
      .object({
        mode: z.literal("selected"),
        studentProfileIds: z.array(z.string().trim().min(1).max(100)).min(1).max(500),
      })
      .strict(),
  ])
  .default({ mode: "everyone" });

const integrityPolicySchema = z
  .object({
    violationLimit: z.number().int().min(1).max(100).nullable().default(null),
    action: z.enum(["log_only", "warn", "auto_submit"]).default("log_only"),
  })
  .strict()
  .default({ violationLimit: null, action: "log_only" })
  .superRefine((value, context) => {
    if (value.violationLimit === null && value.action !== "log_only") {
      context.addIssue({
        code: "custom",
        path: ["violationLimit"],
        message: "Set a violation limit before choosing a warn or auto-submit action.",
      });
    }
  });

export const assessmentVersionInputSchema = z
  .object({
    changeSummary: nullableText(2_000),
    durationSeconds: z
      .number()
      .int()
      .min(60)
      .max(8 * 60 * 60)
      .nullable(),
    fullscreenRequired: z.boolean().default(false),
    randomizeQuestionOrder: z.boolean().default(true),
    poolSelections: z
      .record(z.string().trim().min(1).max(100), z.number().int().min(1).max(100))
      .default({}),
    camera: z
      .object({
        required: z.boolean().default(false),
        policyVersion: z.string().trim().min(1).max(100).nullable(),
        headTrackingEnabled: z.boolean().default(false),
        objectDetectionEnabled: z.boolean().default(false),
        evidenceCaptureEnabled: z.boolean().default(false),
      })
      .strict()
      .default({
        required: false,
        policyVersion: null,
        headTrackingEnabled: false,
        objectDetectionEnabled: false,
        evidenceCaptureEnabled: false,
      }),
    audience: audienceSchema,
    maxAttempts: z.number().int().min(1).max(100).nullable().default(null),
    integrityPolicy: integrityPolicySchema,
    questions: z.array(assessmentQuestionInputSchema).min(1).max(300),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.camera.required && !value.camera.policyVersion) {
      context.addIssue({
        code: "custom",
        path: ["camera", "policyVersion"],
        message: "A camera policy version is required.",
      });
    }
    if (!value.camera.required && value.camera.policyVersion) {
      context.addIssue({
        code: "custom",
        path: ["camera", "policyVersion"],
        message: "A camera policy is only valid when the camera is required.",
      });
    }
    if (!value.camera.required && value.camera.headTrackingEnabled) {
      context.addIssue({
        code: "custom",
        path: ["camera", "headTrackingEnabled"],
        message: "Head tracking requires the camera to be required.",
      });
    }
    if (value.camera.evidenceCaptureEnabled && !value.camera.headTrackingEnabled) {
      context.addIssue({
        code: "custom",
        path: ["camera", "evidenceCaptureEnabled"],
        message: "Evidence capture requires head tracking to be enabled.",
      });
    }
    if (value.camera.objectDetectionEnabled && !value.camera.headTrackingEnabled) {
      context.addIssue({
        code: "custom",
        path: ["camera", "objectDetectionEnabled"],
        message: "Object detection requires head tracking to be enabled.",
      });
    }
    const poolSizes = new Map<string, number>();
    for (const question of value.questions) {
      if (question.poolId)
        poolSizes.set(question.poolId, (poolSizes.get(question.poolId) ?? 0) + 1);
    }
    for (const [poolId, count] of Object.entries(value.poolSelections)) {
      const available = poolSizes.get(poolId) ?? 0;
      if (available === 0 || count > available) {
        context.addIssue({
          code: "custom",
          path: ["poolSelections", poolId],
          message: "Pool selection exceeds its available questions.",
        });
      }
    }
  });

export const createAssessmentSchema = z
  .object({
    subjectId: requiredText(100),
    title: requiredText(240),
    description: nullableText(8_000),
    type: z.enum(["diagnostic", "quiz", "exam", "practice"]),
    status: z.enum(["draft", "published"]).default("draft"),
    version: assessmentVersionInputSchema,
  })
  .strict();

export const startAttemptSchema = z
  .object({
    cameraConsent: z
      .object({
        accepted: z.boolean(),
        policyVersion: requiredText(100),
      })
      .strict()
      .nullable()
      .default(null),
  })
  .strict();

export const createVersionRequestSchema = z
  .object({
    publish: z.boolean().default(false),
    version: assessmentVersionInputSchema,
  })
  .strict();

export const saveAssessmentAnswerSchema = z
  .object({
    answerText: z.string().max(50_000).nullable(),
    timeSpentSeconds: z
      .number()
      .int()
      .min(0)
      .max(8 * 60 * 60)
      .nullable()
      .default(null),
  })
  .strict();

const STUDENT_DETECTABLE_EVENT_TYPES = [
  "focus_loss",
  "fullscreen_exit",
  "tab_switch",
  "connectivity_interruption",
  "copy_attempt",
  "paste_attempt",
  "browser_minimized",
  "cut_attempt",
  "select_all_attempt",
  "print_attempt",
  "save_attempt",
  "view_source_attempt",
  "context_menu_attempt",
  "drag_attempt",
  "devtools_shortcut",
  "camera_ready",
  "camera_disconnected",
  "face_missing",
  "face_returned",
  "multiple_faces",
  "gaze_away",
  "external_device_suspected",
  "phone_detected",
  "unusual_item_detected",
  "eyes_closed",
] as const;

export const integritySignalSchema = z
  .object({
    eventType: z.enum(STUDENT_DETECTABLE_EVENT_TYPES),
    clientOccurredAt: z.string().datetime().nullable().default(null),
    metadata: z
      .record(
        z.string().max(80),
        z.union([z.string().max(500), z.number().finite(), z.boolean(), z.null()]),
      )
      .nullable()
      .default(null),
  })
  .strict();

/** Client-side guards emit many state-transition signals; batch them into one round trip. */
export const integritySignalBatchSchema = z
  .object({
    signals: z.array(integritySignalSchema).min(1).max(50),
  })
  .strict();

/**
 * The subset of `AssessmentEventType` an evidence photo may be attached to — the client-reported
 * *triggering* type, not the `"evidence_captured"` type the stored event row actually carries
 * (see `AssessmentEvidenceRecord` in models.ts). Shared by the client capture module and the
 * server-side upload handler so both enforce the same allowlist.
 */
export const EVIDENCE_CAPTURE_EVENT_TYPES = [
  "multiple_faces",
  "face_missing",
  "external_device_suspected",
  "phone_detected",
  "unusual_item_detected",
  "eyes_closed",
] as const;

export const EVIDENCE_MAX_SIZE_BYTES = 500_000;

export const recordEvidenceSchema = z
  .object({
    eventType: z.enum(EVIDENCE_CAPTURE_EVENT_TYPES),
    mimeType: z.literal("image/jpeg"),
    sizeBytes: z
      .number()
      .int()
      .positive()
      .max(EVIDENCE_MAX_SIZE_BYTES),
  })
  .strict();

export const attemptListSchema = z
  .object({
    cursor: z.string().trim().min(1).max(128).nullable().default(null),
    limit: z.number().int().min(1).max(100).default(25),
  })
  .strict();

export const submitAssessmentSchema = z
  .object({
    honorStatementAccepted: z.boolean(),
  })
  .strict();

export const diagnosticReportSchema = z
  .object({
    summary: requiredText(12_000),
    strengths: nullableText(12_000),
    gaps: nullableText(12_000),
    recommendedNextSteps: nullableText(12_000),
  })
  .strict();

export const consultationSchema = z
  .object({
    consultedAt: z.string().datetime().nullable().default(null),
  })
  .strict();

export type CreateAssessmentInput = z.input<typeof createAssessmentSchema>;
export type AssessmentVersionInput = z.input<typeof assessmentVersionInputSchema>;
export type CreateVersionRequestInput = z.input<typeof createVersionRequestSchema>;
export type StartAttemptInput = z.input<typeof startAttemptSchema>;
export type SaveAssessmentAnswerInput = z.input<typeof saveAssessmentAnswerSchema>;
export type IntegritySignalInput = z.input<typeof integritySignalSchema>;
export type IntegritySignalBatchInput = z.input<typeof integritySignalBatchSchema>;
export type AttemptListInput = z.input<typeof attemptListSchema>;
export type SubmitAssessmentInput = z.input<typeof submitAssessmentSchema>;
export type DiagnosticReportInput = z.input<typeof diagnosticReportSchema>;
export type ConsultationInput = z.input<typeof consultationSchema>;
export type RecordEvidenceInput = z.input<typeof recordEvidenceSchema>;
