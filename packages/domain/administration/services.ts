import { ulid } from "ulid";

import { AdministrationError } from "./errors";
import type {
  AdministrationActor,
  AdministrationDatabase,
  AuditPort,
  AuditQueryFilters,
  ExportStatus,
} from "./models";
import {
  createDiscountInputSchema,
  decideBulkExportInputSchema,
  decideMassDeletionInputSchema,
  decideRoleElevationInputSchema,
  decideSecuritySettingChangeInputSchema,
  liftTutorSuspensionInputSchema,
  reportDecisionInputSchema,
  requestBulkExportInputSchema,
  requestMassDeletionInputSchema,
  requestRoleElevationInputSchema,
  requestSecuritySettingChangeInputSchema,
  resolvePrivacyRequestInputSchema,
  suspendTutorInputSchema,
  tutorDocumentDecisionInputSchema,
  tutorVerificationDecisionInputSchema,
  type CreateDiscountInput,
  type DecideBulkExportInput,
  type DecideMassDeletionInput,
  type DecideRoleElevationInput,
  type DecideSecuritySettingChangeInput,
  type LiftTutorSuspensionInput,
  type ReportDecisionInput,
  type RequestBulkExportInput,
  type RequestMassDeletionInput,
  type RequestRoleElevationInput,
  type RequestSecuritySettingChangeInput,
  type ResolvePrivacyRequestInput,
  type SuspendTutorInput,
  type TutorDocumentDecisionInput,
  type TutorVerificationDecisionInput,
} from "./schemas";

function requireActor(
  actor: AdministrationActor | null | undefined,
): asserts actor is AdministrationActor {
  if (!actor)
    throw new AdministrationError("UNAUTHENTICATED", "A signed-in actor is required.", 401);
}

function isStaff(actor: AdministrationActor): boolean {
  return actor.roles.includes("administrator") || actor.roles.includes("super_administrator");
}

function requireStaff(
  actor: AdministrationActor | null | undefined,
): asserts actor is AdministrationActor {
  requireActor(actor);
  if (!isStaff(actor))
    throw new AdministrationError("FORBIDDEN", "Only staff can perform this action.", 403);
}

function requireSuperAdmin(
  actor: AdministrationActor | null | undefined,
): asserts actor is AdministrationActor {
  requireActor(actor);
  if (!actor.roles.includes("super_administrator")) {
    throw new AdministrationError(
      "FORBIDDEN",
      "Only a super-administrator can perform this action.",
      403,
    );
  }
}

/**
 * Mirrors `@app/auth` `rbac.ts`'s `STEP_UP_FRESHNESS_MINUTES` — duplicated for the same
 * import-boundary reason as `AdministrationRole` (`models.ts`). `@app/auth`'s `authorize()` is
 * still the authoritative, role-aware step-up gate at the web layer; this is defense in depth so
 * a high-risk service function never proceeds on stale MFA even if a caller forgets to check.
 */
const STEP_UP_FRESHNESS_MINUTES = 15;

function requireStepUpFresh(actor: AdministrationActor, now: Date): void {
  const verifiedAt = actor.mfaVerifiedAt;
  const freshMs = STEP_UP_FRESHNESS_MINUTES * 60_000;
  const fresh = verifiedAt != null && now.getTime() - verifiedAt.getTime() <= freshMs;
  if (!fresh) {
    throw new AdministrationError(
      "STEP_UP_REQUIRED",
      "A fresh MFA verification is required for this high-risk action.",
      401,
    );
  }
}

// -------------------------------------------------------------------------------------------
// User approval / suspension (spec §16.4 dashboards & queues)
// -------------------------------------------------------------------------------------------

export function listPendingUserApprovals(
  database: AdministrationDatabase,
  actor: AdministrationActor | null | undefined,
) {
  requireStaff(actor);
  return database.listPendingUsers();
}

export async function approveUserAccount(
  database: AdministrationDatabase,
  audit: AuditPort,
  actor: AdministrationActor | null | undefined,
  targetUserId: string,
  reason: string,
) {
  requireStaff(actor);
  // Mirrors @app/auth's `admin.approve_user` hard prohibition: an admin cannot approve their own account.
  if (actor.userId === targetUserId) {
    throw new AdministrationError(
      "SELF_APPROVAL_FORBIDDEN",
      "You cannot approve your own account.",
      403,
    );
  }
  const user = await database.findUserById(targetUserId);
  if (!user) throw new AdministrationError("NOT_FOUND", "User was not found.", 404);
  if (user.status !== "pending") {
    throw new AdministrationError(
      "INVALID_TRANSITION",
      "Only a pending account can be approved.",
      409,
    );
  }
  const updated = await database.setUserStatus(targetUserId, "active");
  await audit.recordAudit({
    actorUserId: actor.userId,
    action: "admin.user_approved",
    resourceType: "users",
    resourceId: targetUserId,
    reason,
    previousValue: { status: "pending" },
    newValue: { status: "active" },
  });
  return updated;
}

export async function suspendUserAccount(
  database: AdministrationDatabase,
  audit: AuditPort,
  actor: AdministrationActor | null | undefined,
  targetUserId: string,
  reason: string,
) {
  requireStaff(actor);
  if (actor.userId === targetUserId) {
    throw new AdministrationError("FORBIDDEN", "You cannot suspend your own account.", 403);
  }
  const user = await database.findUserById(targetUserId);
  if (!user) throw new AdministrationError("NOT_FOUND", "User was not found.", 404);
  if (user.status === "suspended") return user;
  const updated = await database.setUserStatus(targetUserId, "suspended");
  await audit.recordAudit({
    actorUserId: actor.userId,
    action: "admin.user_suspended",
    resourceType: "users",
    resourceId: targetUserId,
    reason,
    previousValue: { status: user.status },
    newValue: { status: "suspended" },
  });
  return updated;
}

export async function reinstateUserAccount(
  database: AdministrationDatabase,
  audit: AuditPort,
  actor: AdministrationActor | null | undefined,
  targetUserId: string,
  reason: string,
) {
  requireStaff(actor);
  const user = await database.findUserById(targetUserId);
  if (!user) throw new AdministrationError("NOT_FOUND", "User was not found.", 404);
  if (user.status !== "suspended") {
    throw new AdministrationError(
      "INVALID_TRANSITION",
      "Only a suspended account can be reinstated.",
      409,
    );
  }
  const updated = await database.setUserStatus(targetUserId, "active");
  await audit.recordAudit({
    actorUserId: actor.userId,
    action: "admin.user_reinstated",
    resourceType: "users",
    resourceId: targetUserId,
    reason,
    previousValue: { status: "suspended" },
    newValue: { status: "active" },
  });
  return updated;
}

// -------------------------------------------------------------------------------------------
// Tutor verification review
// -------------------------------------------------------------------------------------------

export function listPendingTutorVerifications(
  database: AdministrationDatabase,
  actor: AdministrationActor | null | undefined,
) {
  requireStaff(actor);
  return database.listPendingTutorVerifications();
}

/** `tutor_verifications` never lets a tutor approve their own record (packages/db schema docstring) — enforced here. */
export async function decideTutorVerification(
  database: AdministrationDatabase,
  audit: AuditPort,
  actor: AdministrationActor | null | undefined,
  input: TutorVerificationDecisionInput,
) {
  requireStaff(actor);
  const values = tutorVerificationDecisionInputSchema.parse(input);
  const verification = await database.findTutorVerificationById(values.verificationId);
  if (!verification)
    throw new AdministrationError("NOT_FOUND", "Verification record was not found.", 404);
  if (verification.tutorUserId === actor.userId) {
    throw new AdministrationError(
      "SELF_VERIFICATION_FORBIDDEN",
      "A tutor cannot verify their own record.",
      403,
    );
  }
  const updated = await database.decideTutorVerification(values.verificationId, {
    status: values.decision,
    verifiedByUserId: actor.userId,
    notes: values.notes ?? null,
  });
  await audit.recordAudit({
    actorUserId: actor.userId,
    action: `tutor_verification.${values.decision}`,
    resourceType: "tutor_verifications",
    resourceId: values.verificationId,
    reason: values.notes ?? `Verification marked ${values.decision}.`,
    previousValue: { status: verification.status },
    newValue: { status: values.decision },
  });
  return updated;
}

export function listPendingTutorDocuments(
  database: AdministrationDatabase,
  actor: AdministrationActor | null | undefined,
) {
  requireStaff(actor);
  return database.listPendingTutorDocuments();
}

export async function decideTutorDocument(
  database: AdministrationDatabase,
  audit: AuditPort,
  actor: AdministrationActor | null | undefined,
  input: TutorDocumentDecisionInput,
) {
  requireStaff(actor);
  const values = tutorDocumentDecisionInputSchema.parse(input);
  const document = await database.findTutorDocumentById(values.documentId);
  if (!document) throw new AdministrationError("NOT_FOUND", "Document was not found.", 404);
  if (document.tutorUserId === actor.userId) {
    throw new AdministrationError(
      "SELF_VERIFICATION_FORBIDDEN",
      "A tutor cannot review their own document.",
      403,
    );
  }
  const updated = await database.decideTutorDocument(values.documentId, {
    status: values.decision,
    reviewedByUserId: actor.userId,
    notes: values.notes ?? null,
  });
  await audit.recordAudit({
    actorUserId: actor.userId,
    action: `tutor_document.${values.decision}`,
    resourceType: "tutor_documents",
    resourceId: values.documentId,
    reason: values.notes ?? `Document marked ${values.decision}.`,
    previousValue: { status: document.status },
    newValue: { status: values.decision },
  });
  return updated;
}

// -------------------------------------------------------------------------------------------
// Tutor suspensions
// -------------------------------------------------------------------------------------------

export function listActiveTutorSuspensions(
  database: AdministrationDatabase,
  actor: AdministrationActor | null | undefined,
) {
  requireStaff(actor);
  return database.listActiveTutorSuspensions();
}

export async function suspendTutor(
  database: AdministrationDatabase,
  audit: AuditPort,
  actor: AdministrationActor | null | undefined,
  input: SuspendTutorInput,
) {
  requireStaff(actor);
  const values = suspendTutorInputSchema.parse(input);
  const ownerUserId = await database.findTutorOwnerUserId(values.tutorProfileId);
  if (!ownerUserId) throw new AdministrationError("NOT_FOUND", "Tutor profile was not found.", 404);

  const suspension = await database.transaction(async (transaction) => {
    const created = await transaction.createTutorSuspension({
      id: ulid(),
      tutorProfileId: values.tutorProfileId,
      reason: values.reason,
      startAt: new Date(),
      endAt: values.endAt ?? null,
      issuedByUserId: actor.userId,
    });
    await transaction.setTutorProfileStatus(values.tutorProfileId, "suspended");
    return created;
  });

  await audit.recordAudit({
    actorUserId: actor.userId,
    action: "tutor.suspended",
    resourceType: "tutor_suspensions",
    resourceId: suspension.id,
    reason: values.reason,
    newValue: { tutorProfileId: values.tutorProfileId, endAt: values.endAt ?? null },
  });
  return suspension;
}

export async function liftTutorSuspension(
  database: AdministrationDatabase,
  audit: AuditPort,
  actor: AdministrationActor | null | undefined,
  input: LiftTutorSuspensionInput,
) {
  requireStaff(actor);
  const values = liftTutorSuspensionInputSchema.parse(input);
  const suspension = await database.findTutorSuspensionById(values.suspensionId);
  if (!suspension)
    throw new AdministrationError("NOT_FOUND", "Suspension record was not found.", 404);
  if (suspension.liftedAt) return suspension;

  const now = new Date();
  const lifted = await database.transaction(async (transaction) => {
    const updated = await transaction.liftTutorSuspension(values.suspensionId, {
      liftedByUserId: actor.userId,
      liftedAt: now,
    });
    await transaction.setTutorProfileStatus(suspension.tutorProfileId, "active");
    return updated;
  });

  await audit.recordAudit({
    actorUserId: actor.userId,
    action: "tutor.suspension_lifted",
    resourceType: "tutor_suspensions",
    resourceId: values.suspensionId,
    reason: values.reason,
    previousValue: { liftedAt: null },
    newValue: { liftedAt: now },
  });
  return lifted;
}

// -------------------------------------------------------------------------------------------
// Disputes (abuse reports) and content moderation
// -------------------------------------------------------------------------------------------

export function listOpenDisputes(
  database: AdministrationDatabase,
  actor: AdministrationActor | null | undefined,
) {
  requireStaff(actor);
  return database.listOpenAbuseReports();
}

export async function decideDispute(
  database: AdministrationDatabase,
  audit: AuditPort,
  actor: AdministrationActor | null | undefined,
  input: ReportDecisionInput,
) {
  requireStaff(actor);
  const values = reportDecisionInputSchema.parse(input);
  const report = await database.findAbuseReportById(values.reportId);
  if (!report) throw new AdministrationError("NOT_FOUND", "Report was not found.", 404);
  const updated = await database.decideAbuseReport(values.reportId, {
    status: values.status,
    resolvedByUserId: actor.userId,
  });
  await audit.recordAudit({
    actorUserId: actor.userId,
    action: `dispute.${values.status}`,
    resourceType: "abuse_reports",
    resourceId: values.reportId,
    reason: `Marked ${values.status}.`,
    previousValue: { status: report.status },
    newValue: { status: values.status },
  });
  return updated;
}

export function listModerationQueue(
  database: AdministrationDatabase,
  actor: AdministrationActor | null | undefined,
) {
  requireStaff(actor);
  return database.listOpenContentReports();
}

export async function decideModerationItem(
  database: AdministrationDatabase,
  audit: AuditPort,
  actor: AdministrationActor | null | undefined,
  input: ReportDecisionInput,
) {
  requireStaff(actor);
  const values = reportDecisionInputSchema.parse(input);
  const report = await database.findContentReportById(values.reportId);
  if (!report) throw new AdministrationError("NOT_FOUND", "Report was not found.", 404);
  const updated = await database.decideContentReport(values.reportId, {
    status: values.status,
    resolvedByUserId: actor.userId,
  });
  await audit.recordAudit({
    actorUserId: actor.userId,
    action: `moderation.${values.status}`,
    resourceType: "content_reports",
    resourceId: values.reportId,
    reason: `Marked ${values.status}.`,
    previousValue: { status: report.status },
    newValue: { status: values.status },
  });
  return updated;
}

export function listOpenSupportTickets(
  database: AdministrationDatabase,
  actor: AdministrationActor | null | undefined,
) {
  requireStaff(actor);
  return database.listOpenSupportTickets();
}

export async function resolveSupportTicket(
  database: AdministrationDatabase,
  audit: AuditPort,
  actor: AdministrationActor | null | undefined,
  ticketId: string,
  reason: string,
) {
  requireStaff(actor);
  const ticket = await database.findSupportTicketById(ticketId);
  if (!ticket) throw new AdministrationError("NOT_FOUND", "Ticket was not found.", 404);
  const updated = await database.resolveSupportTicket(ticketId, { status: "resolved" });
  await audit.recordAudit({
    actorUserId: actor.userId,
    action: "support_ticket.resolved",
    resourceType: "support_tickets",
    resourceId: ticketId,
    reason,
    previousValue: { status: ticket.status },
    newValue: { status: "resolved" },
  });
  return updated;
}

// -------------------------------------------------------------------------------------------
// Bulk export — the reference two-person high-risk flow (see packages/audit/README.md)
// -------------------------------------------------------------------------------------------

export async function requestBulkExport(
  database: AdministrationDatabase,
  audit: AuditPort,
  actor: AdministrationActor | null | undefined,
  input: RequestBulkExportInput,
) {
  requireStaff(actor);
  const values = requestBulkExportInputSchema.parse(input);
  const exportRecord = await database.createExport({
    id: ulid(),
    requestedByUserId: actor.userId,
    type: values.type,
    filters: values.filters,
  });
  const approval = await audit.requestApproval({
    actorUserId: actor.userId,
    action: "bulk_export",
    resourceType: "exports",
    resourceId: exportRecord.id,
    reason: values.reason,
    payload: { type: values.type, filters: values.filters },
  });
  await audit.recordAudit({
    actorUserId: actor.userId,
    action: "export.requested",
    resourceType: "exports",
    resourceId: exportRecord.id,
    reason: values.reason,
    newValue: { type: values.type, filters: values.filters },
  });
  return { export: exportRecord, approvalRequestId: approval.approvalRequestId };
}

export async function decideBulkExport(
  database: AdministrationDatabase,
  audit: AuditPort,
  actor: AdministrationActor | null | undefined,
  input: DecideBulkExportInput,
) {
  requireStaff(actor);
  requireStepUpFresh(actor, new Date());
  const values = decideBulkExportInputSchema.parse(input);
  const exportRecord = await database.findExportById(values.exportId);
  if (!exportRecord)
    throw new AdministrationError("NOT_FOUND", "Export request was not found.", 404);
  if (exportRecord.status !== "pending") {
    throw new AdministrationError(
      "INVALID_TRANSITION",
      "Only a pending export can be decided.",
      409,
    );
  }

  // Defense in depth, on the schema-native `requested_by_user_id` column, independent of (and in
  // addition to) the audit trail's own requester-vs-approver check inside
  // `audit.approveHighRiskAction` below — see packages/audit/README.md, "Anchor the export
  // two-person flow on existing columns."
  if (exportRecord.requestedByUserId === actor.userId) {
    throw new AdministrationError(
      "SELF_APPROVAL_FORBIDDEN",
      "The requester cannot approve their own export.",
      403,
    );
  }

  const decision = await audit.approveHighRiskAction({
    approvalRequestId: values.approvalRequestId,
    approverUserId: actor.userId,
    decision: values.decision,
    reason: values.reason,
  });
  if (decision.targetResourceType !== "exports" || decision.targetResourceId !== values.exportId) {
    throw new AdministrationError(
      "APPROVAL_ACTION_MISMATCH",
      "This approval request does not match the given export.",
      409,
    );
  }

  const nextStatus: ExportStatus = values.decision === "approved" ? "processing" : "failed";
  const updated = await database.setExportDecision(values.exportId, {
    status: nextStatus,
    approvedByUserId: values.decision === "approved" ? actor.userId : null,
  });
  await audit.recordAudit({
    actorUserId: actor.userId,
    action: `export.${values.decision}`,
    resourceType: "exports",
    resourceId: values.exportId,
    reason: values.reason,
    previousValue: { status: exportRecord.status },
    newValue: { status: nextStatus },
  });
  return updated;
}

export function listExports(
  database: AdministrationDatabase,
  actor: AdministrationActor | null | undefined,
) {
  requireStaff(actor);
  return database.listExports();
}

// -------------------------------------------------------------------------------------------
// Role elevation
// -------------------------------------------------------------------------------------------

export async function requestRoleElevation(
  database: AdministrationDatabase,
  audit: AuditPort,
  actor: AdministrationActor | null | undefined,
  input: RequestRoleElevationInput,
) {
  requireSuperAdmin(actor);
  const values = requestRoleElevationInputSchema.parse(input);
  if (values.targetUserId === actor.userId) {
    throw new AdministrationError(
      "FORBIDDEN",
      "You cannot request a role elevation for yourself.",
      403,
    );
  }
  const target = await database.findUserById(values.targetUserId);
  if (!target) throw new AdministrationError("NOT_FOUND", "Target user was not found.", 404);

  return audit.requestApproval({
    actorUserId: actor.userId,
    action: "role_elevation",
    resourceType: "user_roles",
    resourceId: values.targetUserId,
    reason: values.reason,
    payload: { targetUserId: values.targetUserId, roleKey: values.roleKey },
  });
}

export async function decideRoleElevation(
  database: AdministrationDatabase,
  audit: AuditPort,
  actor: AdministrationActor | null | undefined,
  input: DecideRoleElevationInput,
) {
  requireSuperAdmin(actor);
  requireStepUpFresh(actor, new Date());
  const values = decideRoleElevationInputSchema.parse(input);

  const decision = await audit.approveHighRiskAction({
    approvalRequestId: values.approvalRequestId,
    approverUserId: actor.userId,
    decision: values.decision,
    reason: values.reason,
  });
  if (decision.action !== "role_elevation") {
    throw new AdministrationError(
      "APPROVAL_ACTION_MISMATCH",
      "This approval request is not a role elevation.",
      409,
    );
  }
  if (values.decision === "approved") {
    const payload = decision.payload as { targetUserId: string; roleKey: string };
    await database.grantRole(payload.targetUserId, payload.roleKey, actor.userId);
  }
  return decision;
}

// -------------------------------------------------------------------------------------------
// Mass deletion
// -------------------------------------------------------------------------------------------

export async function requestMassDeletion(
  database: AdministrationDatabase,
  audit: AuditPort,
  actor: AdministrationActor | null | undefined,
  input: RequestMassDeletionInput,
) {
  requireStaff(actor);
  // `deletion.execute` is unconditionally step-up gated in @app/auth's STEP_UP_ACTIONS — requested
  // here too, not only at decide-time, so this service's own gate matches what authorize() will
  // enforce at the web layer for every call site of that action.
  requireStepUpFresh(actor, new Date());
  const values = requestMassDeletionInputSchema.parse(input);
  // Created directly in the `"blocked"` state — it becomes eligible for the retention worker
  // (`apps/worker/src/jobs/admin/retention-deletion.job.ts`) only once `decideMassDeletion` below
  // flips it to `"scheduled"`. The worker itself additionally re-checks the legal/optional
  // classification (`retention.ts`) at run time regardless of this approval.
  const job = await database.createDeletionJob({
    id: ulid(),
    privacyRequestId: values.privacyRequestId ?? null,
    targetEntityType: values.targetEntityType,
    targetEntityId: values.targetEntityId,
    scope: values.scope,
    status: "blocked",
    blockReason: "pending_approval",
    scheduledFor: values.scheduledFor ?? null,
    createdByUserId: actor.userId,
  });
  const approval = await audit.requestApproval({
    actorUserId: actor.userId,
    action: "mass_deletion",
    resourceType: "deletion_jobs",
    resourceId: job.id,
    reason: values.reason,
    payload: {
      targetEntityType: values.targetEntityType,
      targetEntityId: values.targetEntityId,
      scope: values.scope,
    },
  });
  await audit.recordAudit({
    actorUserId: actor.userId,
    action: "deletion_job.requested",
    resourceType: "deletion_jobs",
    resourceId: job.id,
    reason: values.reason,
    newValue: {
      targetEntityType: values.targetEntityType,
      targetEntityId: values.targetEntityId,
      scope: values.scope,
    },
  });
  return { job, approvalRequestId: approval.approvalRequestId };
}

export async function decideMassDeletion(
  database: AdministrationDatabase,
  audit: AuditPort,
  actor: AdministrationActor | null | undefined,
  input: DecideMassDeletionInput,
) {
  requireStaff(actor);
  requireStepUpFresh(actor, new Date());
  const values = decideMassDeletionInputSchema.parse(input);
  const job = await database.findDeletionJobById(values.deletionJobId);
  if (!job) throw new AdministrationError("NOT_FOUND", "Deletion job was not found.", 404);
  if (job.status !== "blocked" || job.blockReason !== "pending_approval") {
    throw new AdministrationError(
      "INVALID_TRANSITION",
      "Only a deletion job pending approval can be decided.",
      409,
    );
  }
  // Same defense-in-depth pattern as `decideBulkExport`, against `deletion_jobs.created_by_user_id`.
  if (job.createdByUserId === actor.userId) {
    throw new AdministrationError(
      "SELF_APPROVAL_FORBIDDEN",
      "The requester cannot approve their own deletion job.",
      403,
    );
  }

  const decision = await audit.approveHighRiskAction({
    approvalRequestId: values.approvalRequestId,
    approverUserId: actor.userId,
    decision: values.decision,
    reason: values.reason,
  });
  if (
    decision.targetResourceType !== "deletion_jobs" ||
    decision.targetResourceId !== values.deletionJobId
  ) {
    throw new AdministrationError(
      "APPROVAL_ACTION_MISMATCH",
      "This approval request does not match the given deletion job.",
      409,
    );
  }

  const updated =
    values.decision === "approved"
      ? await database.setDeletionJobStatus(values.deletionJobId, {
          status: "scheduled",
          blockReason: null,
        })
      : await database.setDeletionJobStatus(values.deletionJobId, {
          status: "blocked",
          blockReason: "rejected",
        });
  await audit.recordAudit({
    actorUserId: actor.userId,
    action: `deletion_job.${values.decision}`,
    resourceType: "deletion_jobs",
    resourceId: values.deletionJobId,
    reason: values.reason,
    previousValue: { status: job.status },
    newValue: { status: updated.status },
  });
  return updated;
}

export function listDeletionJobs(
  database: AdministrationDatabase,
  actor: AdministrationActor | null | undefined,
) {
  requireStaff(actor);
  return database.listDeletionJobs();
}

// -------------------------------------------------------------------------------------------
// Data export/deletion request workflow (privacy_requests)
// -------------------------------------------------------------------------------------------

export function listPrivacyRequests(
  database: AdministrationDatabase,
  actor: AdministrationActor | null | undefined,
) {
  requireStaff(actor);
  return database.listPrivacyRequests();
}

export async function resolvePrivacyRequest(
  database: AdministrationDatabase,
  audit: AuditPort,
  actor: AdministrationActor | null | undefined,
  input: ResolvePrivacyRequestInput,
) {
  requireStaff(actor);
  const values = resolvePrivacyRequestInputSchema.parse(input);
  const request = await database.findPrivacyRequestById(values.requestId);
  if (!request) throw new AdministrationError("NOT_FOUND", "Privacy request was not found.", 404);
  const updated = await database.resolvePrivacyRequest(values.requestId, {
    status: values.status,
    notes: values.notes ?? null,
    resolvedByUserId: actor.userId,
  });
  await audit.recordAudit({
    actorUserId: actor.userId,
    action: `privacy_request.${values.status}`,
    resourceType: "privacy_requests",
    resourceId: values.requestId,
    reason: values.notes ?? `Marked ${values.status}.`,
    previousValue: { status: request.status },
    newValue: { status: values.status },
  });
  return updated;
}

// -------------------------------------------------------------------------------------------
// Discounts
// -------------------------------------------------------------------------------------------

export function listDiscounts(
  database: AdministrationDatabase,
  actor: AdministrationActor | null | undefined,
) {
  requireStaff(actor);
  return database.listDiscounts();
}

export async function createDiscount(
  database: AdministrationDatabase,
  audit: AuditPort,
  actor: AdministrationActor | null | undefined,
  input: CreateDiscountInput,
) {
  requireStaff(actor);
  const values = createDiscountInputSchema.parse(input);
  const discount = await database.createDiscount({
    id: ulid(),
    code: values.code ?? null,
    type: values.type,
    percentOff: values.percentOff ?? null,
    amountOffMinor: values.amountOffMinor ?? null,
    currency: values.currency ?? null,
    startsAt: values.startsAt ?? null,
    endsAt: values.endsAt ?? null,
    createdByUserId: actor.userId,
  });
  await audit.recordAudit({
    actorUserId: actor.userId,
    action: "discount.created",
    resourceType: "discounts",
    resourceId: discount.id,
    reason: values.reason,
    newValue: {
      type: values.type,
      percentOff: values.percentOff ?? null,
      amountOffMinor: values.amountOffMinor ?? null,
    },
  });
  return discount;
}

export async function deactivateDiscount(
  database: AdministrationDatabase,
  audit: AuditPort,
  actor: AdministrationActor | null | undefined,
  discountId: string,
  reason: string,
) {
  requireStaff(actor);
  const updated = await database.setDiscountActive(discountId, false);
  await audit.recordAudit({
    actorUserId: actor.userId,
    action: "discount.deactivated",
    resourceType: "discounts",
    resourceId: discountId,
    reason,
  });
  return updated;
}

// -------------------------------------------------------------------------------------------
// Security settings — "disabling security controls" is one of spec §16.4's high-risk kinds
// -------------------------------------------------------------------------------------------

const SECURITY_SETTING_KEY_PREFIX = "security.";

export async function requestSecuritySettingChange(
  database: AdministrationDatabase,
  audit: AuditPort,
  actor: AdministrationActor | null | undefined,
  input: RequestSecuritySettingChangeInput,
) {
  requireSuperAdmin(actor);
  const values = requestSecuritySettingChangeInputSchema.parse(input);
  if (!values.key.startsWith(SECURITY_SETTING_KEY_PREFIX)) {
    throw new AdministrationError(
      "INVALID_INPUT",
      `Security setting keys must start with "${SECURITY_SETTING_KEY_PREFIX}".`,
      400,
    );
  }
  return audit.requestApproval({
    actorUserId: actor.userId,
    action: "disable_security_control",
    resourceType: "system_settings",
    resourceId: values.key,
    reason: values.reason,
    payload: { key: values.key, value: values.value, description: values.description ?? null },
  });
}

export async function decideSecuritySettingChange(
  database: AdministrationDatabase,
  audit: AuditPort,
  actor: AdministrationActor | null | undefined,
  input: DecideSecuritySettingChangeInput,
) {
  requireSuperAdmin(actor);
  requireStepUpFresh(actor, new Date());
  const values = decideSecuritySettingChangeInputSchema.parse(input);

  const decision = await audit.approveHighRiskAction({
    approvalRequestId: values.approvalRequestId,
    approverUserId: actor.userId,
    decision: values.decision,
    reason: values.reason,
  });
  if (decision.action !== "disable_security_control") {
    throw new AdministrationError(
      "APPROVAL_ACTION_MISMATCH",
      "This approval request is not a security-setting change.",
      409,
    );
  }
  if (values.decision === "approved") {
    const payload = decision.payload as { key: string; value: unknown; description: string | null };
    await database.upsertSystemSetting({
      key: payload.key,
      value: payload.value,
      description: payload.description,
      updatedByUserId: actor.userId,
    });
  }
  return decision;
}

// -------------------------------------------------------------------------------------------
// Audit log + staff access reasons
// -------------------------------------------------------------------------------------------

export function queryAdminAuditLog(
  audit: AuditPort,
  actor: AdministrationActor | null | undefined,
  filters: AuditQueryFilters,
) {
  requireStaff(actor);
  requireStepUpFresh(actor, new Date());
  return audit.queryEvents(filters);
}

/**
 * System-triggered, not actor-triggered — called by `apps/worker/src/jobs/admin/backup-verification-alert.job.ts`
 * with no signed-in actor, so this deliberately has no `requireStaff` gate (there is no actor to
 * check). `audit.recordAudit` is still called with `actorUserId: null`, matching every other
 * worker-originated audit event in this module (see `retention-deletion.job.ts`).
 */
export async function raiseSystemIncident(
  database: AdministrationDatabase,
  audit: Pick<AuditPort, "recordAudit">,
  values: {
    title: string;
    description: string;
    severity: "low" | "medium" | "high" | "critical";
    relatedEntityType?: string | null;
    relatedEntityId?: string | null;
  },
): Promise<{ id: string }> {
  const incident = await database.createIncident(values);
  await audit.recordAudit({
    actorUserId: null,
    action: "backup_verification.alert_raised",
    resourceType: "incidents",
    resourceId: incident.id,
    reason: values.description,
  });
  return incident;
}

export async function recordStaffAccess(
  audit: AuditPort,
  actor: AdministrationActor | null | undefined,
  input: { targetEntityType: string; targetEntityId: string; reason: string; action?: string },
) {
  requireStaff(actor);
  await audit.recordAdminAccessReason({
    adminUserId: actor.userId,
    targetEntityType: input.targetEntityType,
    targetEntityId: input.targetEntityId,
    reason: input.reason,
    action: input.action,
  });
}
