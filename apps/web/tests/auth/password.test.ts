import { describe, expect, it } from "vitest";

import {
  checkPasswordResetToken,
  hashPassword,
  issuePasswordResetToken,
  validatePasswordStrength,
  verifyPassword,
} from "@app/auth";

describe("hashPassword / verifyPassword", () => {
  it("accepts the correct password", async () => {
    const hash = await hashPassword("Correct-Horse-Battery-9");
    await expect(verifyPassword(hash, "Correct-Horse-Battery-9")).resolves.toBe(true);
  });

  it("rejects a wrong password", async () => {
    const hash = await hashPassword("Correct-Horse-Battery-9");
    await expect(verifyPassword(hash, "wrong-password")).resolves.toBe(false);
  });

  it("rejects a malformed hash instead of throwing", async () => {
    await expect(verifyPassword("not-a-real-hash", "anything")).resolves.toBe(false);
  });
});

describe("validatePasswordStrength", () => {
  it("accepts a long password with mixed character classes", () => {
    expect(validatePasswordStrength("Tutoring!Session2026").valid).toBe(true);
  });

  it("rejects a too-short password", () => {
    const result = validatePasswordStrength("Ab1!");
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => /at least 12/.test(error))).toBe(true);
  });

  it("rejects a long but single-character-class password", () => {
    const result = validatePasswordStrength("aaaaaaaaaaaaaaaa");
    expect(result.valid).toBe(false);
  });

  it("rejects a common password even if it meets length/class checks", () => {
    const result = validatePasswordStrength("Password1234");
    expect(result.valid).toBe(false);
  });
});

describe("password reset tokens", () => {
  it("accepts a freshly issued, unused token", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const issued = issuePasswordResetToken(now);
    const result = checkPasswordResetToken(
      issued.token,
      { tokenHash: issued.tokenHash, expiresAt: issued.expiresAt, usedAt: null },
      now,
    );
    expect(result).toEqual({ valid: true });
  });

  it("rejects an expired token", () => {
    const issuedAt = new Date("2026-01-01T00:00:00Z");
    const issued = issuePasswordResetToken(issuedAt, 30);
    const afterExpiry = new Date(issuedAt.getTime() + 31 * 60_000);

    const result = checkPasswordResetToken(
      issued.token,
      { tokenHash: issued.tokenHash, expiresAt: issued.expiresAt, usedAt: null },
      afterExpiry,
    );
    expect(result).toEqual({ valid: false, reason: "expired" });
  });

  it("rejects a token that has already been used (single-use)", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const issued = issuePasswordResetToken(now);
    const result = checkPasswordResetToken(
      issued.token,
      { tokenHash: issued.tokenHash, expiresAt: issued.expiresAt, usedAt: now },
      now,
    );
    expect(result).toEqual({ valid: false, reason: "used" });
  });

  it("rejects a token whose value doesn't match the stored hash", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const issued = issuePasswordResetToken(now);
    const result = checkPasswordResetToken(
      "completely-wrong-token",
      { tokenHash: issued.tokenHash, expiresAt: issued.expiresAt, usedAt: null },
      now,
    );
    expect(result).toEqual({ valid: false, reason: "invalid" });
  });
});
