import { authorize, type Actor, type Role } from "@app/auth";

import { AdministrationError } from "../../../../../packages/domain/administration/errors";

function requireAllowed(result: ReturnType<typeof authorize>): void {
  if (!result.allowed) {
    throw new AdministrationError("FORBIDDEN", result.reason, 403);
  }
}

/**
 * General "this actor may use the admin workspace" gate — staff only, no self-target. Spec §4's
 * fixed `@app/auth` action catalog has no dedicated entry for several screens this module needs
 * (disputes, moderation, discounts, tutor verification/suspension review), so — mirroring
 * `apps/web/app/(app)/consent/authorization.ts`'s `authorizeConsentWorkspace` treatment of the
 * same kind of catalog gap — `admin.approve_user` with no `targetUserId` stands in as the general
 * "isStaff" capability check for those screens. Domain services still re-check role/self
 * constraints independently (see `packages/domain/administration/services.ts`).
 */
export function authorizeAdminWorkspace(actor: Actor): void {
  requireAllowed(authorize(actor, "admin.approve_user", { kind: "admin_action" }));
}

export function authorizeApproveUser(actor: Actor, targetUserId: string): void {
  requireAllowed(authorize(actor, "admin.approve_user", { kind: "admin_action", targetUserId }));
}

export function authorizeSuspendAccount(actor: Actor, targetRole: Role): void {
  requireAllowed(authorize(actor, "account.suspend", { kind: "user_account", targetRole }));
}

export function authorizeRoleElevation(actor: Actor, targetUserId: string): void {
  requireAllowed(authorize(actor, "admin.manage_roles", { kind: "admin_action", targetUserId }));
}

export function authorizeExportRequest(actor: Actor): void {
  requireAllowed(authorize(actor, "export.data", { kind: "export_job" }));
}

/** `export.bulk` is step-up gated (`STEP_UP_ACTIONS` in `@app/auth`'s rbac.ts) — deciding a request needs fresh MFA. */
export function authorizeExportDecision(actor: Actor): void {
  requireAllowed(authorize(actor, "export.bulk", { kind: "export_job" }));
}

/** Step-up gated. Used for both requesting and deciding — `@app/auth` has one `deletion.execute` action. */
export function authorizeMassDeletion(actor: Actor): void {
  requireAllowed(authorize(actor, "deletion.execute", { kind: "deletion_job" }));
}

/** Step-up gated. */
export function authorizeAuditView(actor: Actor): void {
  requireAllowed(authorize(actor, "audit.view", { kind: "audit_event" }));
}

/** Super-administrator only, step-up gated. */
export function authorizeSecuritySetting(actor: Actor): void {
  requireAllowed(authorize(actor, "security.configure", { kind: "security_setting" }));
}
