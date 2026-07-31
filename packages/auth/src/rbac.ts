/**
 * Role/action/policy catalog for the authorization engine (`./authorize.ts`). This is the
 * canonical list — every entry here must be wired into a switch branch in `authorize()`, and
 * every branch in `authorize()` must correspond to an entry here. See `README.md` for the full
 * permission matrix in table form.
 *
 * `academic_manager` (spec §4.7) is Phase 2 and deliberately omitted from the MVP role set.
 */
export const ROLES = [
  "parent",
  "student",
  "tutor",
  "finance",
  "administrator",
  "super_administrator",
] as const;
export type Role = (typeof ROLES)[number];

/**
 * Actions the authorization engine understands, namespaced by resource kind. Adding a new action
 * here without a matching `case` in `authorize()` is a compile error (see the exhaustiveness
 * check at the bottom of that function's switch) — the two are not allowed to drift apart.
 */
export const ACTIONS = [
  "account.create",
  "account.suspend",
  "student.view_profile",
  "student.manage_profile",
  "academic.view_record",
  "academic.edit_learning_plan",
  "message.send",
  "message.read",
  "message.access_as_staff",
  "finance.view_transactions",
  "finance.generate_payout",
  "finance.refund",
  "admin.approve_user",
  "admin.manage_roles",
  "export.data",
  "export.bulk",
  "audit.view",
  "audit.erase",
  "deletion.execute",
  "security.configure",
] as const;
export type Action = (typeof ACTIONS)[number];

/** Spec §12.1: MFA required for administrator/finance/super-admin, recommended for tutors, optional for parents. */
export const MFA_REQUIREMENT: Record<Role, "required" | "recommended" | "optional"> = {
  parent: "optional",
  student: "optional",
  tutor: "recommended",
  finance: "required",
  administrator: "required",
  super_administrator: "required",
};

/**
 * Absolute session lifetime per role, in minutes (spec §12.1: "shorter session lifetime for
 * administrators"). These are MVP defaults, not values pulled from legal/compliance review —
 * revisit before public launch.
 */
export const SESSION_LIFETIME_MINUTES: Record<Role, number> = {
  parent: 60 * 24 * 14,
  student: 60 * 24 * 14,
  tutor: 60 * 24 * 7,
  finance: 120,
  administrator: 120,
  super_administrator: 60,
};

/** Most conservative (shortest) lifetime across every role held by the actor. */
export function resolveSessionLifetimeMinutes(roles: readonly Role[]): number {
  if (roles.length === 0) {
    throw new Error("resolveSessionLifetimeMinutes requires at least one role");
  }
  return Math.min(...roles.map((role) => SESSION_LIFETIME_MINUTES[role]));
}

/**
 * Actions gated behind spec §16.4 step-up authentication (on top of ordinary login MFA):
 * bulk export, role elevation, audit access, mass deletion, disabling security controls.
 * "Large refund" is handled separately in `authorize()` since it depends on the refund amount,
 * not the action alone.
 */
export const STEP_UP_ACTIONS: ReadonlySet<Action> = new Set<Action>([
  "export.bulk",
  "admin.manage_roles",
  "audit.view",
  "deletion.execute",
  "security.configure",
]);

/** Refunds at or above this amount require step-up MFA, regardless of role (spec §16.4 "large refund"). */
export const LARGE_REFUND_THRESHOLD_MINOR = 20_000; // $200.00 in USD cents

/**
 * How many minutes an MFA verification stays "fresh" for step-up purposes (see
 * `authorize.ts`'s `isMfaFreshEnough`). Deliberately short relative to `SESSION_LIFETIME_MINUTES`
 * — step-up must reflect a recent re-challenge, not the verification that happened at login.
 */
export const STEP_UP_FRESHNESS_MINUTES = 15;
