"use server";

import { isAuditError } from "@app/audit";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { isAdministrationError } from "../../../../../packages/domain/administration/errors";
import {
  approveUserAccount,
  createDiscount,
  deactivateDiscount,
  decideBulkExport,
  decideDispute,
  decideMassDeletion,
  decideModerationItem,
  decideRoleElevation,
  decideSecuritySettingChange,
  decideTutorDocument,
  decideTutorVerification,
  liftTutorSuspension,
  reinstateUserAccount,
  requestBulkExport,
  requestMassDeletion,
  requestRoleElevation,
  requestSecuritySettingChange,
  resolvePrivacyRequest,
  resolveSupportTicket,
  suspendTutor,
  suspendUserAccount,
} from "../../../../../packages/domain/administration/services";
import type { AdminActionState } from "./action-state";
import {
  authorizeAdminWorkspace,
  authorizeApproveUser,
  authorizeAuditView,
  authorizeExportDecision,
  authorizeExportRequest,
  authorizeMassDeletion,
  authorizeRoleElevation,
  authorizeSecuritySetting,
  authorizeSuspendAccount,
} from "./authorization";
import { currentAdministrationContext } from "./context";

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function optionalStr(formData: FormData, key: string): string | null {
  const value = str(formData, key);
  return value === "" ? null : value;
}

function errorState(error: unknown): AdminActionState {
  if (error instanceof z.ZodError) {
    return { status: "error", message: "errors.invalid", fieldErrors: error.flatten().fieldErrors };
  }
  if (isAdministrationError(error)) {
    return { status: "error", message: `errors.${error.code}`, fieldErrors: {} };
  }
  // `audit.approveHighRiskAction`/`requestApproval` (real `@app/audit`, wired in `runtime.ts`) can
  // throw its own `AuditError` directly — its codes (`SELF_APPROVAL_FORBIDDEN`,
  // `APPROVAL_NOT_FOUND`, `APPROVAL_ALREADY_RESOLVED`, `INVALID_INPUT`) are a subset of
  // `AdministrationErrorCode`'s, so they share the same `admin.errors.*` i18n keys.
  if (isAuditError(error)) {
    return { status: "error", message: `errors.${error.code}`, fieldErrors: {} };
  }
  return { status: "error", message: "errors.generic", fieldErrors: {} };
}

function ok(message: string): AdminActionState {
  return { status: "success", message, fieldErrors: {} };
}

// -- Users ------------------------------------------------------------------------------------

export async function approveUserActionHandler(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  try {
    const context = await currentAdministrationContext();
    const targetUserId = str(formData, "userId");
    authorizeApproveUser(context.actor, targetUserId);
    await approveUserAccount(
      context.database,
      context.audit,
      context.actor,
      targetUserId,
      optionalStr(formData, "reason") ?? "Approved by staff.",
    );
    revalidatePath("/admin/users");
    return ok("feedback.userApproved");
  } catch (error) {
    return errorState(error);
  }
}

export async function suspendUserActionHandler(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  try {
    const context = await currentAdministrationContext();
    const targetUserId = str(formData, "userId");
    authorizeSuspendAccount(context.actor, "student");
    await suspendUserAccount(
      context.database,
      context.audit,
      context.actor,
      targetUserId,
      str(formData, "reason"),
    );
    revalidatePath("/admin/users");
    return ok("feedback.userSuspended");
  } catch (error) {
    return errorState(error);
  }
}

export async function reinstateUserActionHandler(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  try {
    const context = await currentAdministrationContext();
    const targetUserId = str(formData, "userId");
    authorizeSuspendAccount(context.actor, "student");
    await reinstateUserAccount(
      context.database,
      context.audit,
      context.actor,
      targetUserId,
      str(formData, "reason"),
    );
    revalidatePath("/admin/users");
    return ok("feedback.userReinstated");
  } catch (error) {
    return errorState(error);
  }
}

// -- Tutor verification / documents -----------------------------------------------------------

export async function decideTutorVerificationActionHandler(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  try {
    const context = await currentAdministrationContext();
    authorizeAdminWorkspace(context.actor);
    await decideTutorVerification(context.database, context.audit, context.actor, {
      verificationId: str(formData, "verificationId"),
      decision: str(formData, "decision") as "passed" | "failed" | "waived",
      notes: optionalStr(formData, "notes"),
    });
    revalidatePath("/admin/verifications");
    return ok("feedback.verificationDecided");
  } catch (error) {
    return errorState(error);
  }
}

export async function decideTutorDocumentActionHandler(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  try {
    const context = await currentAdministrationContext();
    authorizeAdminWorkspace(context.actor);
    await decideTutorDocument(context.database, context.audit, context.actor, {
      documentId: str(formData, "documentId"),
      decision: str(formData, "decision") as "approved" | "rejected",
      notes: optionalStr(formData, "notes"),
    });
    revalidatePath("/admin/verifications");
    return ok("feedback.documentDecided");
  } catch (error) {
    return errorState(error);
  }
}

// -- Tutor suspensions --------------------------------------------------------------------------

export async function suspendTutorActionHandler(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  try {
    const context = await currentAdministrationContext();
    authorizeSuspendAccount(context.actor, "tutor");
    const endAtRaw = optionalStr(formData, "endAt");
    await suspendTutor(context.database, context.audit, context.actor, {
      tutorProfileId: str(formData, "tutorProfileId"),
      reason: str(formData, "reason"),
      endAt: endAtRaw ? new Date(endAtRaw) : null,
    });
    revalidatePath("/admin/suspensions");
    return ok("feedback.tutorSuspended");
  } catch (error) {
    return errorState(error);
  }
}

export async function liftTutorSuspensionActionHandler(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  try {
    const context = await currentAdministrationContext();
    authorizeSuspendAccount(context.actor, "tutor");
    await liftTutorSuspension(context.database, context.audit, context.actor, {
      suspensionId: str(formData, "suspensionId"),
      reason: str(formData, "reason"),
    });
    revalidatePath("/admin/suspensions");
    return ok("feedback.suspensionLifted");
  } catch (error) {
    return errorState(error);
  }
}

// -- Disputes / moderation / support -------------------------------------------------------------

export async function decideDisputeActionHandler(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  try {
    const context = await currentAdministrationContext();
    authorizeAdminWorkspace(context.actor);
    await decideDispute(context.database, context.audit, context.actor, {
      reportId: str(formData, "reportId"),
      status: str(formData, "status") as "reviewing" | "resolved" | "dismissed",
    });
    revalidatePath("/admin/disputes");
    return ok("feedback.disputeDecided");
  } catch (error) {
    return errorState(error);
  }
}

export async function decideModerationActionHandler(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  try {
    const context = await currentAdministrationContext();
    authorizeAdminWorkspace(context.actor);
    await decideModerationItem(context.database, context.audit, context.actor, {
      reportId: str(formData, "reportId"),
      status: str(formData, "status") as "reviewing" | "resolved" | "dismissed",
    });
    revalidatePath("/admin/moderation");
    return ok("feedback.moderationDecided");
  } catch (error) {
    return errorState(error);
  }
}

export async function resolveSupportTicketActionHandler(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  try {
    const context = await currentAdministrationContext();
    authorizeAdminWorkspace(context.actor);
    await resolveSupportTicket(
      context.database,
      context.audit,
      context.actor,
      str(formData, "ticketId"),
      str(formData, "reason"),
    );
    revalidatePath("/admin/support");
    return ok("feedback.ticketResolved");
  } catch (error) {
    return errorState(error);
  }
}

// -- Bulk export (two-person approval showcase) --------------------------------------------------

export async function requestBulkExportActionHandler(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  try {
    const context = await currentAdministrationContext();
    authorizeExportRequest(context.actor);
    await requestBulkExport(context.database, context.audit, context.actor, {
      type: str(formData, "type"),
      filters: {},
      reason: str(formData, "reason"),
    });
    revalidatePath("/admin/exports");
    return ok("feedback.exportRequested");
  } catch (error) {
    return errorState(error);
  }
}

export async function decideBulkExportActionHandler(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  try {
    const context = await currentAdministrationContext();
    authorizeExportDecision(context.actor);
    await decideBulkExport(context.database, context.audit, context.actor, {
      exportId: str(formData, "exportId"),
      approvalRequestId: str(formData, "approvalRequestId"),
      decision: str(formData, "decision") as "approved" | "rejected",
      reason: str(formData, "reason"),
    });
    revalidatePath("/admin/exports");
    return ok("feedback.exportDecided");
  } catch (error) {
    return errorState(error);
  }
}

// -- Role elevation ---------------------------------------------------------------------------

export async function requestRoleElevationActionHandler(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  try {
    const context = await currentAdministrationContext();
    const targetUserId = str(formData, "targetUserId");
    authorizeRoleElevation(context.actor, targetUserId);
    await requestRoleElevation(context.database, context.audit, context.actor, {
      targetUserId,
      roleKey: str(formData, "roleKey") as "finance" | "administrator" | "super_administrator",
      reason: str(formData, "reason"),
    });
    revalidatePath("/admin/roles");
    return ok("feedback.roleElevationRequested");
  } catch (error) {
    return errorState(error);
  }
}

export async function decideRoleElevationActionHandler(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  try {
    const context = await currentAdministrationContext();
    authorizeRoleElevation(context.actor, str(formData, "approvalRequestId"));
    await decideRoleElevation(context.database, context.audit, context.actor, {
      approvalRequestId: str(formData, "approvalRequestId"),
      decision: str(formData, "decision") as "approved" | "rejected",
      reason: str(formData, "reason"),
    });
    revalidatePath("/admin/roles");
    return ok("feedback.roleElevationDecided");
  } catch (error) {
    return errorState(error);
  }
}

// -- Mass deletion ------------------------------------------------------------------------------

export async function requestMassDeletionActionHandler(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  try {
    const context = await currentAdministrationContext();
    authorizeMassDeletion(context.actor);
    const scheduledForRaw = optionalStr(formData, "scheduledFor");
    await requestMassDeletion(context.database, context.audit, context.actor, {
      targetEntityType: str(formData, "targetEntityType"),
      targetEntityId: str(formData, "targetEntityId"),
      scope: str(formData, "scope") as "full_erase" | "anonymize",
      reason: str(formData, "reason"),
      privacyRequestId: optionalStr(formData, "privacyRequestId"),
      scheduledFor: scheduledForRaw ? new Date(scheduledForRaw) : null,
    });
    revalidatePath("/admin/deletions");
    return ok("feedback.deletionRequested");
  } catch (error) {
    return errorState(error);
  }
}

export async function decideMassDeletionActionHandler(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  try {
    const context = await currentAdministrationContext();
    authorizeMassDeletion(context.actor);
    await decideMassDeletion(context.database, context.audit, context.actor, {
      deletionJobId: str(formData, "deletionJobId"),
      approvalRequestId: str(formData, "approvalRequestId"),
      decision: str(formData, "decision") as "approved" | "rejected",
      reason: str(formData, "reason"),
    });
    revalidatePath("/admin/deletions");
    return ok("feedback.deletionDecided");
  } catch (error) {
    return errorState(error);
  }
}

export async function resolvePrivacyRequestActionHandler(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  try {
    const context = await currentAdministrationContext();
    authorizeAdminWorkspace(context.actor);
    await resolvePrivacyRequest(context.database, context.audit, context.actor, {
      requestId: str(formData, "requestId"),
      status: str(formData, "status") as "in_review" | "approved" | "rejected" | "completed",
      notes: optionalStr(formData, "notes"),
    });
    revalidatePath("/admin/deletions");
    return ok("feedback.privacyRequestResolved");
  } catch (error) {
    return errorState(error);
  }
}

// -- Discounts ----------------------------------------------------------------------------------

export async function createDiscountActionHandler(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  try {
    const context = await currentAdministrationContext();
    authorizeAdminWorkspace(context.actor);
    const percentOff = optionalStr(formData, "percentOff");
    const amountOffMinorRaw = optionalStr(formData, "amountOffMinor");
    await createDiscount(context.database, context.audit, context.actor, {
      code: optionalStr(formData, "code"),
      type: str(formData, "type") as "sibling" | "referral" | "promotional" | "admin_manual",
      percentOff,
      amountOffMinor: amountOffMinorRaw ? Number(amountOffMinorRaw) : null,
      currency: (optionalStr(formData, "currency") as "USD" | "AMD" | null) ?? null,
      startsAt: null,
      endsAt: null,
      reason: str(formData, "reason"),
    });
    revalidatePath("/admin/discounts");
    return ok("feedback.discountCreated");
  } catch (error) {
    return errorState(error);
  }
}

export async function deactivateDiscountActionHandler(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  try {
    const context = await currentAdministrationContext();
    authorizeAdminWorkspace(context.actor);
    await deactivateDiscount(
      context.database,
      context.audit,
      context.actor,
      str(formData, "discountId"),
      str(formData, "reason"),
    );
    revalidatePath("/admin/discounts");
    return ok("feedback.discountDeactivated");
  } catch (error) {
    return errorState(error);
  }
}

// -- Security settings ----------------------------------------------------------------------------

export async function requestSecuritySettingChangeActionHandler(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  try {
    const context = await currentAdministrationContext();
    authorizeSecuritySetting(context.actor);
    await requestSecuritySettingChange(context.database, context.audit, context.actor, {
      key: str(formData, "key"),
      value: str(formData, "value"),
      description: optionalStr(formData, "description"),
      reason: str(formData, "reason"),
    });
    revalidatePath("/admin/security");
    return ok("feedback.securityChangeRequested");
  } catch (error) {
    return errorState(error);
  }
}

export async function decideSecuritySettingChangeActionHandler(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  try {
    const context = await currentAdministrationContext();
    authorizeSecuritySetting(context.actor);
    await decideSecuritySettingChange(context.database, context.audit, context.actor, {
      approvalRequestId: str(formData, "approvalRequestId"),
      decision: str(formData, "decision") as "approved" | "rejected",
      reason: str(formData, "reason"),
    });
    revalidatePath("/admin/security");
    return ok("feedback.securityChangeDecided");
  } catch (error) {
    return errorState(error);
  }
}

// -- Audit log access (records the fact that staff pulled the log itself, defense in depth) --------

export async function assertAuditViewAllowedForPage(): Promise<void> {
  const context = await currentAdministrationContext();
  authorizeAuditView(context.actor);
}
