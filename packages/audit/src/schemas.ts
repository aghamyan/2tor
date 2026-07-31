import { z } from "zod";

export const recordAuditInputSchema = z
  .object({
    actorUserId: z.string().min(1).nullable(),
    action: z.string().min(1),
    resourceType: z.string().min(1),
    resourceId: z.string().min(1).nullish(),
    reason: z.string().min(1).nullish(),
    previousValue: z.unknown().optional(),
    newValue: z.unknown().optional(),
    ipAddress: z.string().min(1).nullish(),
  })
  .strict();

export type RecordAuditInput = z.infer<typeof recordAuditInputSchema>;

export const recordAdminAccessInputSchema = z
  .object({
    adminUserId: z.string().min(1),
    targetEntityType: z.string().min(1),
    targetEntityId: z.string().min(1),
    reason: z.string().min(1),
    /** Defaults to the action, e.g. `"staff.message_access"` — see `admin-access.ts`. */
    action: z.string().min(1).optional(),
  })
  .strict();

export type RecordAdminAccessInput = z.infer<typeof recordAdminAccessInputSchema>;

export const auditQueryFiltersSchema = z
  .object({
    actorUserId: z.string().min(1).optional(),
    action: z.string().min(1).optional(),
    resourceType: z.string().min(1).optional(),
    resourceId: z.string().min(1).optional(),
    from: z.date().optional(),
    to: z.date().optional(),
    cursor: z.string().min(1).optional(),
    limit: z.number().int().min(1).max(200).optional(),
  })
  .strict();

export const HIGH_RISK_ACTIONS = [
  "bulk_export",
  "role_elevation",
  "audit_access",
  "mass_deletion",
  "large_refund",
  "payment_config_change",
  "disable_security_control",
] as const;

export type HighRiskAction = (typeof HIGH_RISK_ACTIONS)[number];

export const requestApprovalInputSchema = z
  .object({
    actorUserId: z.string().min(1),
    action: z.enum(HIGH_RISK_ACTIONS),
    resourceType: z.string().min(1),
    resourceId: z.string().min(1),
    reason: z.string().min(1),
    payload: z.unknown().optional(),
  })
  .strict();

export type RequestApprovalInput = z.infer<typeof requestApprovalInputSchema>;

export const APPROVAL_DECISIONS = ["approved", "rejected"] as const;
export type ApprovalDecisionValue = (typeof APPROVAL_DECISIONS)[number];

export const approveHighRiskActionInputSchema = z
  .object({
    approvalRequestId: z.string().min(1),
    approverUserId: z.string().min(1),
    decision: z.enum(APPROVAL_DECISIONS),
    reason: z.string().min(1),
  })
  .strict();

export type ApproveHighRiskActionInput = z.infer<typeof approveHighRiskActionInputSchema>;
