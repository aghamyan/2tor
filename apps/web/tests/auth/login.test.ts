import { describe, expect, it } from "vitest";

import { hashPassword, login, type LoginCandidate } from "@app/auth";

async function candidate(overrides: Partial<LoginCandidate> = {}): Promise<LoginCandidate> {
  return {
    userId: "user_1",
    passwordHash: await hashPassword("correct-password-123!"),
    status: "active",
    roles: ["parent"],
    mfaEnabled: false,
    ...overrides,
  };
}

describe("login", () => {
  it("rejects a wrong password", async () => {
    const user = await candidate();
    const result = await login({ user, password: "wrong-password", mfaVerifiedThisAttempt: false });
    expect(result).toEqual({ ok: false, reason: "invalid_credentials" });
  });

  it("accepts the correct password for an active account with no MFA requirement", async () => {
    const user = await candidate();
    const result = await login({
      user,
      password: "correct-password-123!",
      mfaVerifiedThisAttempt: false,
    });
    expect(result).toEqual({ ok: true, userId: "user_1", roles: ["parent"] });
  });

  it("rejects when no account matched, without throwing or leaking timing-sensitive state", async () => {
    const result = await login({ user: null, password: "anything", mfaVerifiedThisAttempt: false });
    expect(result).toEqual({ ok: false, reason: "invalid_credentials" });
  });

  it("blocks a suspended account even with the correct password", async () => {
    const user = await candidate({ status: "suspended" });
    const result = await login({
      user,
      password: "correct-password-123!",
      mfaVerifiedThisAttempt: false,
    });
    expect(result).toEqual({ ok: false, reason: "account_suspended" });
  });

  it("blocks a pending account", async () => {
    const user = await candidate({ status: "pending" });
    const result = await login({
      user,
      password: "correct-password-123!",
      mfaVerifiedThisAttempt: false,
    });
    expect(result).toEqual({ ok: false, reason: "account_pending" });
  });

  it("blocks an administrator without MFA enabled, even with the correct password", async () => {
    const user = await candidate({ roles: ["administrator"], mfaEnabled: false });
    const result = await login({
      user,
      password: "correct-password-123!",
      mfaVerifiedThisAttempt: false,
    });
    expect(result).toEqual({ ok: false, reason: "mfa_setup_required" });
  });

  it("blocks an administrator with MFA enabled but not verified this attempt", async () => {
    const user = await candidate({ roles: ["administrator"], mfaEnabled: true });
    const result = await login({
      user,
      password: "correct-password-123!",
      mfaVerifiedThisAttempt: false,
    });
    expect(result).toEqual({ ok: false, reason: "mfa_verification_required" });
  });

  it("logs in an administrator with MFA enabled and verified this attempt", async () => {
    const user = await candidate({ roles: ["administrator"], mfaEnabled: true });
    const result = await login({
      user,
      password: "correct-password-123!",
      mfaVerifiedThisAttempt: true,
    });
    expect(result).toEqual({ ok: true, userId: "user_1", roles: ["administrator"] });
  });

  it("does not require MFA for a parent even if MFA is not enabled", async () => {
    const user = await candidate({ roles: ["parent"], mfaEnabled: false });
    const result = await login({
      user,
      password: "correct-password-123!",
      mfaVerifiedThisAttempt: false,
    });
    expect(result.ok).toBe(true);
  });
});
