import { verifyTotpCode } from "@app/auth";

export interface ActiveMfaMethod {
  type: string;
  secretReference: string | null;
}

export interface MfaCheckResult {
  mfaEnabled: boolean;
  mfaVerifiedThisAttempt: boolean;
}

/**
 * Resolves the login route's MFA gate inputs from a user's active `mfa_methods` rows.
 * `mfaEnabled` counts any active method regardless of type, matching `assertMfaSatisfied`'s
 * "has MFA enabled at all" semantics — but verification against a submitted code only works
 * against the active TOTP method, since TOTP is the only enrollment path this app supports today.
 */
export function resolveMfaCheck(
  activeMfaMethods: readonly ActiveMfaMethod[],
  submittedCode: string | undefined,
): MfaCheckResult {
  const mfaEnabled = activeMfaMethods.length > 0;
  const totpSecret = activeMfaMethods.find((method) => method.type === "totp")?.secretReference;
  const mfaVerifiedThisAttempt =
    typeof totpSecret === "string" &&
    submittedCode !== undefined &&
    verifyTotpCode(totpSecret, submittedCode);
  return { mfaEnabled, mfaVerifiedThisAttempt };
}
