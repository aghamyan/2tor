import { z } from "zod";

export const decisionInputSchema = z
  .object({
    reason: z.string().trim().min(1),
    notes: z.string().trim().min(1).nullish(),
  })
  .strict();

export const tutorVerificationDecisionInputSchema = z
  .object({
    verificationId: z.string().trim().min(1),
    decision: z.enum(["passed", "failed", "waived"]),
    notes: z.string().trim().min(1).nullish(),
  })
  .strict();
export type TutorVerificationDecisionInput = z.infer<typeof tutorVerificationDecisionInputSchema>;

export const tutorDocumentDecisionInputSchema = z
  .object({
    documentId: z.string().trim().min(1),
    decision: z.enum(["approved", "rejected"]),
    notes: z.string().trim().min(1).nullish(),
  })
  .strict();
export type TutorDocumentDecisionInput = z.infer<typeof tutorDocumentDecisionInputSchema>;

export const suspendTutorInputSchema = z
  .object({
    tutorProfileId: z.string().trim().min(1),
    reason: z.string().trim().min(1),
    endAt: z.coerce.date().nullish(),
  })
  .strict();
export type SuspendTutorInput = z.infer<typeof suspendTutorInputSchema>;

export const liftTutorSuspensionInputSchema = z
  .object({
    suspensionId: z.string().trim().min(1),
    reason: z.string().trim().min(1),
  })
  .strict();
export type LiftTutorSuspensionInput = z.infer<typeof liftTutorSuspensionInputSchema>;

export const reportDecisionInputSchema = z
  .object({
    reportId: z.string().trim().min(1),
    status: z.enum(["reviewing", "resolved", "dismissed"]),
  })
  .strict();
export type ReportDecisionInput = z.infer<typeof reportDecisionInputSchema>;

export const uploadDecisionInputSchema = z
  .object({
    uploadId: z.string().trim().min(1),
    status: z.enum(["approved", "rejected"]),
  })
  .strict();
export type UploadDecisionInput = z.infer<typeof uploadDecisionInputSchema>;

export const requestBulkExportInputSchema = z
  .object({
    type: z.string().trim().min(1),
    filters: z.record(z.string(), z.unknown()).default({}),
    reason: z.string().trim().min(1),
  })
  .strict();
export type RequestBulkExportInput = z.infer<typeof requestBulkExportInputSchema>;

export const decideBulkExportInputSchema = z
  .object({
    exportId: z.string().trim().min(1),
    approvalRequestId: z.string().trim().min(1),
    decision: z.enum(["approved", "rejected"]),
    reason: z.string().trim().min(1),
  })
  .strict();
export type DecideBulkExportInput = z.infer<typeof decideBulkExportInputSchema>;

export const requestRoleElevationInputSchema = z
  .object({
    targetUserId: z.string().trim().min(1),
    roleKey: z.enum(["finance", "administrator", "super_administrator"]),
    reason: z.string().trim().min(1),
  })
  .strict();
export type RequestRoleElevationInput = z.infer<typeof requestRoleElevationInputSchema>;

export const decideRoleElevationInputSchema = z
  .object({
    approvalRequestId: z.string().trim().min(1),
    decision: z.enum(["approved", "rejected"]),
    reason: z.string().trim().min(1),
  })
  .strict();
export type DecideRoleElevationInput = z.infer<typeof decideRoleElevationInputSchema>;

export const requestMassDeletionInputSchema = z
  .object({
    targetEntityType: z.string().trim().min(1),
    targetEntityId: z.string().trim().min(1),
    scope: z.enum(["full_erase", "anonymize"]),
    reason: z.string().trim().min(1),
    privacyRequestId: z.string().trim().min(1).nullish(),
    scheduledFor: z.coerce.date().nullish(),
  })
  .strict();
export type RequestMassDeletionInput = z.infer<typeof requestMassDeletionInputSchema>;

export const decideMassDeletionInputSchema = z
  .object({
    deletionJobId: z.string().trim().min(1),
    approvalRequestId: z.string().trim().min(1),
    decision: z.enum(["approved", "rejected"]),
    reason: z.string().trim().min(1),
  })
  .strict();
export type DecideMassDeletionInput = z.infer<typeof decideMassDeletionInputSchema>;

export const resolvePrivacyRequestInputSchema = z
  .object({
    requestId: z.string().trim().min(1),
    status: z.enum(["in_review", "approved", "rejected", "completed"]),
    notes: z.string().trim().min(1).nullish(),
  })
  .strict();
export type ResolvePrivacyRequestInput = z.infer<typeof resolvePrivacyRequestInputSchema>;

export const createDiscountInputSchema = z
  .object({
    code: z.string().trim().min(1).nullish(),
    type: z.enum(["sibling", "referral", "promotional", "admin_manual"]),
    percentOff: z.string().trim().min(1).nullish(),
    amountOffMinor: z.number().int().min(0).nullish(),
    currency: z.enum(["USD", "AMD"]).nullish(),
    startsAt: z.coerce.date().nullish(),
    endsAt: z.coerce.date().nullish(),
    reason: z.string().trim().min(1),
  })
  .strict()
  .refine(
    (v) =>
      (v.percentOff !== undefined && v.percentOff !== null) ||
      (v.amountOffMinor !== undefined && v.amountOffMinor !== null),
    {
      message: "Provide either percentOff or amountOffMinor.",
    },
  );
export type CreateDiscountInput = z.infer<typeof createDiscountInputSchema>;

export const requestSecuritySettingChangeInputSchema = z
  .object({
    key: z.string().trim().min(1),
    value: z.unknown(),
    description: z.string().trim().min(1).nullish(),
    reason: z.string().trim().min(1),
  })
  .strict();
export type RequestSecuritySettingChangeInput = z.infer<
  typeof requestSecuritySettingChangeInputSchema
>;

export const decideSecuritySettingChangeInputSchema = z
  .object({
    approvalRequestId: z.string().trim().min(1),
    decision: z.enum(["approved", "rejected"]),
    reason: z.string().trim().min(1),
  })
  .strict();
export type DecideSecuritySettingChangeInput = z.infer<
  typeof decideSecuritySettingChangeInputSchema
>;
