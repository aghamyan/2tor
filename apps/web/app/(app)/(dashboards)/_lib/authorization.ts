import { authorize, type Actor, type AuthorizeResult, type Role } from "@app/auth";

import { panelsForDashboard, type DashboardKind, type DashboardPanel } from "./catalog";

const rolesByDashboard: Readonly<Record<DashboardKind, readonly Role[]>> = {
  parent: ["parent"],
  "student-younger": ["student"],
  "student-older": ["student"],
  tutor: ["tutor"],
  admin: ["administrator", "super_administrator"],
  finance: ["finance"],
};

export function actorHasDashboardRole(actor: Actor, kind: DashboardKind): boolean {
  return rolesByDashboard[kind].some((role) => actor.roles.includes(role));
}

/**
 * The auth catalog has broad workspace capabilities rather than a `dashboard.view` action.
 * Dashboard panels expose no records themselves, so this verifies the actor's canonical
 * workspace capability. The linked public module query/service performs its own record and
 * relationship authorization when the streamed summary or destination surface reads data.
 */
export function authorizeDashboardCapability(actor: Actor, kind: DashboardKind): AuthorizeResult {
  if (!actorHasDashboardRole(actor, kind)) {
    return { allowed: false, reason: "dashboard_role_not_permitted" };
  }

  switch (kind) {
    case "parent":
      return authorize(actor, "account.create", {
        kind: "user_account",
        targetRole: "student",
      });
    case "student-younger":
    case "student-older":
      if (!actor.studentProfileId) {
        return { allowed: false, reason: "student_profile_required" };
      }
      return authorize(actor, "academic.view_record", {
        kind: "student",
        studentProfileId: actor.studentProfileId,
      });
    case "tutor":
      // A tutor's dashboard inbox is the common tutor workspace capability. Conversation reads
      // still re-check actual membership; `isMember` here describes the actor's own inbox.
      return authorize(actor, "message.read", {
        kind: "message",
        isAcademic: false,
        isMember: true,
      });
    case "admin":
      return authorize(actor, "admin.approve_user", { kind: "admin_action" });
    case "finance":
      return authorize(actor, "finance.view_transactions", { kind: "financial_record" });
  }
}

export type PanelAuthorization = (
  actor: Actor,
  kind: DashboardKind,
  panel: DashboardPanel,
) => AuthorizeResult;

/**
 * Calls an authorization decision for every candidate panel. Keeping this injectable makes it
 * possible to prove the "every panel is checked" invariant without mocking the auth package.
 */
export function authorizedPanelsForActor(
  actor: Actor,
  kind: DashboardKind,
  decide: PanelAuthorization = (candidate, dashboardKind) =>
    authorizeDashboardCapability(candidate, dashboardKind),
): DashboardPanel[] {
  return panelsForDashboard(kind).filter((panel) => {
    if (!panel.roles.some((role) => actor.roles.includes(role))) return false;
    return decide(actor, kind, panel).allowed;
  });
}

export function preferredDashboardPath(actor: Actor): string | null {
  if (actor.roles.includes("administrator") || actor.roles.includes("super_administrator")) {
    return "/dashboard/admin";
  }
  if (actor.roles.includes("finance")) return "/dashboard/finance";
  if (actor.roles.includes("tutor")) return "/dashboard/tutor";
  if (actor.roles.includes("parent")) return "/dashboard/parent";
  if (actor.roles.includes("student")) return "/dashboard/student";
  return null;
}
