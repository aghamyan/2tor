import {
  LARGE_REFUND_THRESHOLD_MINOR,
  STEP_UP_ACTIONS,
  STEP_UP_FRESHNESS_MINUTES,
  type Action,
  type Role,
} from "./rbac";

export interface Actor {
  userId: string;
  roles: readonly Role[];
  /**
   * When MFA was last verified for this session, or `null`/`undefined` if never. Deliberately a
   * timestamp, not a boolean: step-up actions require a *recent* verification (see
   * `isMfaFreshEnough`), not merely "verified once at login." A session created hours ago with
   * MFA satisfied at login must not silently authorize a high-risk action now with no
   * re-challenge — the caller re-verifies a TOTP/recovery code and sets a fresh value
   * immediately before a step-up-gated call (see `./session.ts`'s `recordStepUpMfaVerification`).
   */
  mfaVerifiedAt?: Date | null;
  /** Set only when the actor's own account is a student, linking them to their own record. */
  studentProfileId?: string;
}

/**
 * The tutor↔student relationship fact this engine needs, shaped exactly like a
 * `tutor_student_assignments` row (see `packages/db/src/schema/matching.ts`). This package
 * cannot depend on `@app/db` (strict pnpm workspace isolation — see README), so the caller reads
 * the row and passes it in; `authorize()` applies the activeness rule itself.
 */
export interface TutorAssignmentFact {
  status: "proposed" | "active" | "ended" | "rejected";
  endAt: Date | null;
}

export type Resource =
  | { kind: "user_account"; targetRole: Role }
  | {
      kind: "student";
      studentProfileId: string;
      tutorAssignment?: TutorAssignmentFact | null;
      parentLinked?: boolean;
    }
  | {
      kind: "message";
      isAcademic: boolean;
      isMember: boolean;
      /** Defense in depth: the conversation schema has no private adult↔child type, but deny explicitly if one is ever passed. */
      isPrivateAdultChildChannel?: boolean;
      /** Whether the caller has already recorded an `admin_access_reasons` row / reason for this access. */
      reasonProvided?: boolean;
    }
  | { kind: "financial_record" }
  | { kind: "refund"; amountMinor: number }
  | { kind: "admin_action"; targetUserId?: string }
  | { kind: "export_job" }
  | { kind: "audit_event" }
  | { kind: "deletion_job" }
  | { kind: "security_setting" };

export type AuthorizeResult = { allowed: true } | { allowed: false; reason: string };

/**
 * Same rule documented in `packages/db/README.md` ("Tutor access is time-bounded, not
 * role-based"): active only while `status === "active"` and (`endAt` is null or in the future).
 * Duplicated here deliberately, as the canonical authorization-time implementation of that rule,
 * since this package cannot import `@app/db` to reuse a shared helper.
 */
function isAssignmentActive(
  assignment: TutorAssignmentFact | null | undefined,
  now: Date,
): boolean {
  if (!assignment) return false;
  if (assignment.status !== "active") return false;
  if (assignment.endAt === null) return true;
  return assignment.endAt.getTime() > now.getTime();
}

/**
 * Whether `mfaVerifiedAt` is recent enough to satisfy step-up authentication. A stale
 * verification (e.g. from login, hours ago) does not count — see the `Actor.mfaVerifiedAt` doc
 * comment for why this is a freshness check rather than a plain boolean flag.
 */
export function isMfaFreshEnough(mfaVerifiedAt: Date | null | undefined, now: Date): boolean {
  if (!mfaVerifiedAt) return false;
  return now.getTime() - mfaVerifiedAt.getTime() <= STEP_UP_FRESHNESS_MINUTES * 60_000;
}

/**
 * Deny-by-default authorization engine implementing spec §4 (see README for the full matrix).
 *
 * Design rules, in order of precedence:
 * 1. Hard prohibitions (no private adult↔child messaging, no self-approval, audit trails are
 *    immutable) are checked first and deny unconditionally — holding an additional role cannot
 *    bypass them.
 * 2. Otherwise, an action is allowed if *any* role the actor holds grants it for this resource
 *    (e.g. a finance+parent actor may still read an academic message via the parent grant, even
 *    though the finance role alone would not grant it).
 * 3. Actions in `STEP_UP_ACTIONS` (plus large refunds) additionally require a *fresh* MFA
 *    verification (`isMfaFreshEnough(actor.mfaVerifiedAt, now)`), not merely one satisfied at
 *    login.
 * 4. Anything not explicitly allowed — including actions/resource kinds unrecognized at
 *    runtime — falls through to a final deny.
 *
 * This function only decides yes/no. Writing the required `admin_access_reasons` row or calling
 * `@app/audit`'s `recordAudit()` for reason-gated/sensitive actions is the caller's
 * responsibility — see README, "Callers must still log".
 */
export function authorize(
  actor: Actor,
  action: Action,
  resource: Resource,
  now: Date = new Date(),
): AuthorizeResult {
  const deny = (reason: string): AuthorizeResult => ({ allowed: false, reason });
  const hasRole = (role: Role): boolean => actor.roles.includes(role);
  const hasAnyRole = (roles: readonly Role[]): boolean => roles.some(hasRole);
  const isStaff = hasAnyRole(["administrator", "super_administrator"]);
  const mfaFresh = isMfaFreshEnough(actor.mfaVerifiedAt, now);

  let permitted = false;
  let denyReason = "role_not_permitted";

  switch (action) {
    case "account.create": {
      if (resource.kind !== "user_account") return deny("resource_kind_mismatch");
      if (hasRole("student")) return deny("students_cannot_create_accounts");
      permitted = isStaff || (hasRole("parent") && resource.targetRole === "student");
      break;
    }

    case "account.suspend": {
      if (resource.kind !== "user_account") return deny("resource_kind_mismatch");
      permitted = isStaff;
      break;
    }

    case "student.view_profile":
    case "academic.view_record": {
      if (resource.kind !== "student") return deny("resource_kind_mismatch");
      permitted =
        (hasRole("student") && actor.studentProfileId === resource.studentProfileId) ||
        (hasRole("parent") && resource.parentLinked === true) ||
        (hasRole("tutor") && isAssignmentActive(resource.tutorAssignment, now)) ||
        isStaff;
      denyReason = "no_relationship";
      break;
    }

    case "student.manage_profile": {
      if (resource.kind !== "student") return deny("resource_kind_mismatch");
      permitted = (hasRole("parent") && resource.parentLinked === true) || isStaff;
      denyReason = "no_relationship";
      break;
    }

    case "academic.edit_learning_plan": {
      if (resource.kind !== "student") return deny("resource_kind_mismatch");
      permitted =
        (hasRole("tutor") && isAssignmentActive(resource.tutorAssignment, now)) || isStaff;
      denyReason = "no_relationship";
      break;
    }

    case "message.send": {
      if (resource.kind !== "message") return deny("resource_kind_mismatch");
      if (resource.isPrivateAdultChildChannel === true)
        return deny("no_private_adult_child_messaging");
      permitted = resource.isMember;
      denyReason = "not_a_conversation_member";
      break;
    }

    case "message.read": {
      if (resource.kind !== "message") return deny("resource_kind_mismatch");
      const financeGrants = hasRole("finance") && resource.isMember && !resource.isAcademic;
      const memberGrants = hasAnyRole(["parent", "tutor", "student"]) && resource.isMember;
      permitted = financeGrants || memberGrants || isStaff;
      denyReason =
        hasRole("finance") && resource.isAcademic
          ? "finance_cannot_read_academic_messages"
          : "not_a_conversation_member";
      break;
    }

    case "message.access_as_staff": {
      if (resource.kind !== "message") return deny("resource_kind_mismatch");
      if (!isStaff) return deny("role_not_permitted");
      if (resource.reasonProvided !== true) return deny("reason_required");
      permitted = true;
      break;
    }

    case "finance.view_transactions":
    case "finance.generate_payout": {
      if (resource.kind !== "financial_record") return deny("resource_kind_mismatch");
      permitted = hasRole("finance") || isStaff;
      break;
    }

    case "finance.refund": {
      if (resource.kind !== "refund") return deny("resource_kind_mismatch");
      if (!hasRole("finance") && !isStaff) return deny("role_not_permitted");
      if (resource.amountMinor >= LARGE_REFUND_THRESHOLD_MINOR && !mfaFresh) {
        return deny("step_up_required");
      }
      permitted = true;
      break;
    }

    case "admin.approve_user":
    case "admin.manage_roles": {
      if (resource.kind !== "admin_action") return deny("resource_kind_mismatch");
      if (resource.targetUserId !== undefined && resource.targetUserId === actor.userId) {
        return deny("cannot_self_approve");
      }
      permitted = action === "admin.manage_roles" ? hasRole("super_administrator") : isStaff;
      break;
    }

    case "export.data": {
      if (resource.kind !== "export_job") return deny("resource_kind_mismatch");
      permitted = isStaff;
      break;
    }

    case "export.bulk": {
      if (resource.kind !== "export_job") return deny("resource_kind_mismatch");
      permitted = isStaff;
      break;
    }

    case "audit.view": {
      if (resource.kind !== "audit_event") return deny("resource_kind_mismatch");
      permitted = isStaff;
      break;
    }

    case "audit.erase": {
      // Unconditional: audit trails are immutable to every role, including super-administrator
      // (spec §4.6, §12.5). There is deliberately no allow branch for this action — it is also
      // enforced at the database level by a trigger (see packages/db migration 0001).
      return deny("audit_trail_is_immutable");
    }

    case "deletion.execute": {
      if (resource.kind !== "deletion_job") return deny("resource_kind_mismatch");
      permitted = isStaff;
      break;
    }

    case "security.configure": {
      if (resource.kind !== "security_setting") return deny("resource_kind_mismatch");
      permitted = hasRole("super_administrator");
      break;
    }

    default: {
      // Exhaustiveness check: adding a new `Action` to rbac.ts without a case above is now a
      // compile error rather than a silent allow. At runtime (e.g. a value cast through
      // `unknown`), this branch is still reachable and denies.
      const exhaustiveCheck: never = action;
      return deny(`unknown_action:${String(exhaustiveCheck)}`);
    }
  }

  if (!permitted) return deny(denyReason);
  if (STEP_UP_ACTIONS.has(action) && !mfaFresh) return deny("step_up_required");
  return { allowed: true };
}
