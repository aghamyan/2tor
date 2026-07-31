import { assertMfaSatisfied } from "./mfa";
import { hashPassword, verifyPassword } from "./password";
import type { Role } from "./rbac";

export type UserStatus = "pending" | "active" | "suspended" | "deleted";

export interface LoginCandidate {
  userId: string;
  passwordHash: string;
  status: UserStatus;
  roles: Role[];
  mfaEnabled: boolean;
}

export interface LoginAttempt {
  /**
   * `null` when no account matched the submitted email/username. Still runs a dummy password
   * verify below so response timing doesn't reveal whether the account exists.
   */
  user: LoginCandidate | null;
  password: string;
  /**
   * Whether a TOTP/recovery code has already been verified for this attempt (via
   * `verifyTotpCode`/`verifyRecoveryCode` in `./mfa.ts`), when the account has MFA enabled.
   */
  mfaVerifiedThisAttempt: boolean;
}

export type LoginResult =
  | { ok: true; userId: string; roles: Role[] }
  | {
      ok: false;
      reason:
        | "invalid_credentials"
        | "account_suspended"
        | "account_pending"
        | "account_deleted"
        | "mfa_setup_required"
        | "mfa_verification_required";
    };

let dummyHashPromise: Promise<string> | null = null;

/** A real, valid argon2id hash of an unguessable, unused password — computed once and reused so a login with no matching user still pays argon2's full verify cost. */
function getDummyHash(): Promise<string> {
  dummyHashPromise ??= hashPassword("no-account-matched-this-login-attempt");
  return dummyHashPromise;
}

/**
 * Pure login decision: password check → account status → MFA gate. Deliberately has no DB or
 * Redis access — the caller looks up `LoginCandidate` and, on `ok: true`, creates a session via
 * `./session.ts`'s `createSession` and writes a `login_events` row.
 */
export async function login(attempt: LoginAttempt): Promise<LoginResult> {
  const hashToCheck = attempt.user?.passwordHash ?? (await getDummyHash());
  const passwordOk = await verifyPassword(hashToCheck, attempt.password);

  if (!attempt.user || !passwordOk) {
    return { ok: false, reason: "invalid_credentials" };
  }

  const { user } = attempt;

  if (user.status === "suspended") return { ok: false, reason: "account_suspended" };
  if (user.status === "deleted") return { ok: false, reason: "account_deleted" };
  if (user.status === "pending") return { ok: false, reason: "account_pending" };

  const mfaGate = assertMfaSatisfied({
    roles: user.roles,
    mfaEnabled: user.mfaEnabled,
    mfaVerified: attempt.mfaVerifiedThisAttempt,
  });
  if (!mfaGate.satisfied) {
    return { ok: false, reason: mfaGate.reason };
  }

  return { ok: true, userId: user.userId, roles: user.roles };
}
