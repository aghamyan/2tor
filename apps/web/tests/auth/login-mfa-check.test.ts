import { generateTotpCode, generateTotpSecret } from "@app/auth";
import { describe, expect, it } from "vitest";

import { resolveMfaCheck } from "../../app/api/auth/login/mfa-check";

describe("resolveMfaCheck", () => {
  it("is disabled and unverified when the account has no active MFA methods", () => {
    expect(resolveMfaCheck([], undefined)).toEqual({
      mfaEnabled: false,
      mfaVerifiedThisAttempt: false,
    });
  });

  it("is enabled but unverified for an active TOTP method with no submitted code", () => {
    const secret = generateTotpSecret();
    const result = resolveMfaCheck([{ type: "totp", secretReference: secret }], undefined);
    expect(result).toEqual({ mfaEnabled: true, mfaVerifiedThisAttempt: false });
  });

  it("is enabled but unverified when the submitted code is wrong", () => {
    const secret = generateTotpSecret();
    const result = resolveMfaCheck([{ type: "totp", secretReference: secret }], "000000");
    expect(result).toEqual({ mfaEnabled: true, mfaVerifiedThisAttempt: false });
  });

  it("is enabled and verified when the submitted code matches the active TOTP secret", () => {
    const secret = generateTotpSecret();
    const now = new Date();
    const code = generateTotpCode(secret, now);
    const result = resolveMfaCheck([{ type: "totp", secretReference: secret }], code);
    expect(result).toEqual({ mfaEnabled: true, mfaVerifiedThisAttempt: true });
  });

  it("counts a non-TOTP active method (e.g. webauthn) as enabled, but it can never verify via a code", () => {
    const result = resolveMfaCheck([{ type: "webauthn", secretReference: null }], "123456");
    expect(result).toEqual({ mfaEnabled: true, mfaVerifiedThisAttempt: false });
  });

  it("ignores a null secretReference on the active TOTP row rather than throwing", () => {
    const result = resolveMfaCheck([{ type: "totp", secretReference: null }], "123456");
    expect(result).toEqual({ mfaEnabled: true, mfaVerifiedThisAttempt: false });
  });
});
