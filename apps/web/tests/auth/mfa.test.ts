import { describe, expect, it } from "vitest";

import {
  assertMfaSatisfied,
  generateRecoveryCodes,
  generateTotpCode,
  generateTotpSecret,
  getTotpProvisioningUri,
  hashRecoveryCode,
  verifyRecoveryCode,
  verifyTotpCode,
} from "@app/auth";

// RFC 6238 Appendix B test vector: ASCII secret "12345678901234567890" (base32
// "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"), SHA-1, 30s step, at T = 59 seconds the 8-digit code is
// "94287082". This pins the implementation against a published external vector rather than a
// generate -> verify round trip, which would still pass even if base32 decode and the HOTP byte
// layout were both wrong in the same self-consistent way.
const RFC6238_SECRET_BASE32 = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

describe("TOTP against the RFC 6238 Appendix B vector", () => {
  it("produces the published 8-digit code at T=59s", () => {
    const code = generateTotpCode(RFC6238_SECRET_BASE32, new Date(59_000), { digits: 8 });
    expect(code).toBe("94287082");
  });

  it("produces the low-order 6 digits of the same vector", () => {
    const code = generateTotpCode(RFC6238_SECRET_BASE32, new Date(59_000), { digits: 6 });
    expect(code).toBe("287082");
  });

  it("verifies that same code via verifyTotpCode", () => {
    expect(
      verifyTotpCode(RFC6238_SECRET_BASE32, "94287082", {
        time: new Date(59_000),
        digits: 8,
        window: 0,
      }),
    ).toBe(true);
  });
});

describe("TOTP generate/verify with a random secret", () => {
  it("verifies a just-generated code and rejects an unrelated one", () => {
    const secret = generateTotpSecret();
    const now = new Date("2026-01-01T00:00:00Z");
    const code = generateTotpCode(secret, now);

    expect(verifyTotpCode(secret, code, { time: now })).toBe(true);
    expect(verifyTotpCode(secret, "000000", { time: now })).toBe(false);
  });

  it("tolerates one period of clock drift but not two", () => {
    const secret = generateTotpSecret();
    const now = new Date("2026-01-01T00:00:00Z");
    const oneStepLater = new Date(now.getTime() + 30_000);
    const twoStepsLater = new Date(now.getTime() + 60_000);
    const code = generateTotpCode(secret, now);

    expect(verifyTotpCode(secret, code, { time: oneStepLater, window: 1 })).toBe(true);
    expect(verifyTotpCode(secret, code, { time: twoStepsLater, window: 1 })).toBe(false);
  });

  it("rejects malformed input without throwing", () => {
    const secret = generateTotpSecret();
    expect(verifyTotpCode(secret, "abc")).toBe(false);
    expect(verifyTotpCode(secret, "12")).toBe(false);
  });
});

describe("getTotpProvisioningUri", () => {
  it("builds an otpauth:// URI containing the issuer and secret", () => {
    const uri = getTotpProvisioningUri({
      secretBase32: RFC6238_SECRET_BASE32,
      accountName: "parent@example.com",
      issuer: "2tor",
    });
    expect(uri.startsWith("otpauth://totp/2tor%3Aparent%40example.com?")).toBe(true);
    expect(uri).toContain(`secret=${RFC6238_SECRET_BASE32}`);
    expect(uri).toContain("issuer=2tor");
  });
});

describe("recovery codes", () => {
  it("generates the requested count of distinct, formatted codes", () => {
    const codes = generateRecoveryCodes(10);
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    for (const code of codes) {
      expect(code).toMatch(/^[A-Z2-9]{5}-[A-Z2-9]{5}$/);
    }
  });

  it("verifies a code against its stored hash and rejects a wrong one", () => {
    const [code] = generateRecoveryCodes(1);
    const hash = hashRecoveryCode(code as string);
    expect(verifyRecoveryCode(code as string, hash)).toBe(true);
    expect(verifyRecoveryCode("ZZZZZ-ZZZZZ", hash)).toBe(false);
  });

  it("is case- and hyphen-insensitive when verifying", () => {
    const [code] = generateRecoveryCodes(1);
    const hash = hashRecoveryCode(code as string);
    const messy = (code as string).toLowerCase().replace("-", "");
    expect(verifyRecoveryCode(messy, hash)).toBe(true);
  });
});

describe("assertMfaSatisfied", () => {
  it("blocks an administrator that has not enabled MFA", () => {
    const result = assertMfaSatisfied({
      roles: ["administrator"],
      mfaEnabled: false,
      mfaVerified: false,
    });
    expect(result).toEqual({ satisfied: false, reason: "mfa_setup_required" });
  });

  it("blocks an administrator with MFA enabled but not verified this attempt", () => {
    const result = assertMfaSatisfied({
      roles: ["administrator"],
      mfaEnabled: true,
      mfaVerified: false,
    });
    expect(result).toEqual({ satisfied: false, reason: "mfa_verification_required" });
  });

  it("allows an administrator with MFA enabled and verified", () => {
    const result = assertMfaSatisfied({
      roles: ["administrator"],
      mfaEnabled: true,
      mfaVerified: true,
    });
    expect(result).toEqual({ satisfied: true });
  });

  it("requires MFA for super_administrator unconditionally", () => {
    const result = assertMfaSatisfied({
      roles: ["super_administrator"],
      mfaEnabled: false,
      mfaVerified: false,
    });
    expect(result.satisfied).toBe(false);
  });

  it("does not require MFA for a parent", () => {
    const result = assertMfaSatisfied({ roles: ["parent"], mfaEnabled: false, mfaVerified: false });
    expect(result).toEqual({ satisfied: true });
  });

  it("requires MFA if any held role requires it, even combined with roles that don't", () => {
    const result = assertMfaSatisfied({
      roles: ["parent", "finance"],
      mfaEnabled: false,
      mfaVerified: false,
    });
    expect(result.satisfied).toBe(false);
  });
});
