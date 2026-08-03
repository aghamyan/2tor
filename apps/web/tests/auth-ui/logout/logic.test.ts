import { createSession, generateCsrfToken, getSession } from "@app/auth";
import { describe, expect, it } from "vitest";

import {
  buildSignedOutPath,
  expiredSessionCookieAttributes,
  isStaffSession,
  performLogout,
  resolveLogoutOutcome,
  resolveRedirectLocale,
  type LogoutAuditPort,
} from "../../../app/(auth)/logout/logic";
import { FakeRedis } from "../../auth/support/fakeRedis";

function fakeAudit() {
  const calls: Array<{ userId: string; sessionId: string; ipAddress: string | null }> = [];
  const audit: LogoutAuditPort = {
    async recordStaffLogout(input) {
      calls.push(input);
    },
  };
  return { audit, calls };
}

describe("resolveLogoutOutcome", () => {
  it("treats a missing session as already signed out (idempotency)", () => {
    expect(resolveLogoutOutcome(null, "anything")).toEqual({ kind: "already_signed_out" });
    expect(resolveLogoutOutcome(null, null)).toEqual({ kind: "already_signed_out" });
  });

  it("rejects a present session with a missing or invalid CSRF token", async () => {
    const redis = new FakeRedis();
    const { session } = await createSession(redis, { userId: "user_1", roles: ["parent"] });

    expect(resolveLogoutOutcome(session, null)).toEqual({ kind: "csrf_rejected" });
    expect(resolveLogoutOutcome(session, "not-the-real-token")).toEqual({ kind: "csrf_rejected" });
  });

  it("accepts a present session with a valid CSRF token", async () => {
    const redis = new FakeRedis();
    const { session } = await createSession(redis, { userId: "user_1", roles: ["parent"] });
    const token = generateCsrfToken(session);

    expect(resolveLogoutOutcome(session, token)).toEqual({ kind: "signed_out", session });
  });
});

describe("isStaffSession", () => {
  it("flags finance/administrator/super_administrator, not ordinary roles", () => {
    expect(isStaffSession({ roles: ["finance"] })).toBe(true);
    expect(isStaffSession({ roles: ["administrator"] })).toBe(true);
    expect(isStaffSession({ roles: ["super_administrator"] })).toBe(true);
    expect(isStaffSession({ roles: ["parent"] })).toBe(false);
    expect(isStaffSession({ roles: ["student", "tutor"] })).toBe(false);
  });
});

describe("performLogout", () => {
  it("deletes the Redis session and does not audit an ordinary user's logout", async () => {
    const redis = new FakeRedis();
    const { session } = await createSession(redis, { userId: "user_1", roles: ["parent"] });
    const token = generateCsrfToken(session);
    const { audit, calls } = fakeAudit();

    const result = await performLogout(
      { redis, audit },
      { sessionId: session.id, csrfToken: token, ipAddress: "203.0.113.4" },
    );

    expect(result.outcome.kind).toBe("signed_out");
    expect(await getSession(redis, session.id)).toBeNull();
    expect(calls).toEqual([]);
  });

  it("audits a staff member's logout with actor, action-implied resource, and no sensitive payload", async () => {
    const redis = new FakeRedis();
    const { session } = await createSession(redis, { userId: "staff_1", roles: ["administrator"] });
    const token = generateCsrfToken(session);
    const { audit, calls } = fakeAudit();

    await performLogout(
      { redis, audit },
      { sessionId: session.id, csrfToken: token, ipAddress: "203.0.113.4" },
    );

    expect(calls).toEqual([
      { userId: "staff_1", sessionId: session.id, ipAddress: "203.0.113.4" },
    ]);
  });

  it("is idempotent: logging out twice in a row both succeed, the second as a no-op", async () => {
    const redis = new FakeRedis();
    const { session } = await createSession(redis, { userId: "user_1", roles: ["parent"] });
    const token = generateCsrfToken(session);
    const { audit } = fakeAudit();

    const first = await performLogout(
      { redis, audit },
      { sessionId: session.id, csrfToken: token, ipAddress: null },
    );
    expect(first.outcome.kind).toBe("signed_out");

    // Second call presents the same (now-dead) session id — exactly what a double-click or a
    // resubmission after the cookie was already cleared would send.
    const second = await performLogout(
      { redis, audit },
      { sessionId: session.id, csrfToken: token, ipAddress: null },
    );
    expect(second.outcome).toEqual({ kind: "already_signed_out" });
  });

  it("rejects an invalid CSRF token without touching the session (session-fixation guard)", async () => {
    const redis = new FakeRedis();
    const { session } = await createSession(redis, { userId: "user_1", roles: ["parent"] });
    const { audit } = fakeAudit();

    const result = await performLogout(
      { redis, audit },
      { sessionId: session.id, csrfToken: "forged", ipAddress: null },
    );

    expect(result.outcome).toEqual({ kind: "csrf_rejected" });
    expect(await getSession(redis, session.id)).not.toBeNull();
  });
});

describe("expiredSessionCookieAttributes", () => {
  it("matches the exact attributes login/route.ts writes the cookie with, for every NODE_ENV", () => {
    const dev = expiredSessionCookieAttributes("test");
    const prod = expiredSessionCookieAttributes("production");

    for (const attrs of [dev, prod]) {
      expect(attrs.name).toBe("session_id");
      expect(attrs.value).toBe("");
      expect(attrs.httpOnly).toBe(true);
      expect(attrs.sameSite).toBe("lax");
      expect(attrs.path).toBe("/");
      expect(attrs.maxAge).toBe(0);
    }
    // `secure` is the one attribute login/route.ts computes from NODE_ENV rather than taking
    // `@app/auth`'s literal `true` default — clearing must mirror exactly that, or a dev/staging
    // cookie (written with `secure: false`) is never actually cleared by this response.
    expect(dev.secure).toBe(false);
    expect(prod.secure).toBe(true);
  });
});

describe("resolveRedirectLocale", () => {
  it("prefers the x-locale header, then the NEXT_LOCALE cookie, then the default", () => {
    expect(resolveRedirectLocale("hy", "en")).toBe("hy");
    expect(resolveRedirectLocale(null, "hy")).toBe("hy");
    expect(resolveRedirectLocale(null, null)).toBe("en");
    expect(resolveRedirectLocale("not-a-locale", "hy")).toBe("hy");
  });
});

describe("buildSignedOutPath", () => {
  it("is locale-prefixed and carries no identifying data", () => {
    expect(buildSignedOutPath("en")).toBe("/en/signed-out");
    expect(buildSignedOutPath("hy")).toBe("/hy/signed-out");
  });
});
