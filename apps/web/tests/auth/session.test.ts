import { describe, expect, it } from "vitest";

import {
  buildExpiredSessionCookie,
  createSession,
  deviceFingerprint,
  generateCsrfToken,
  getSession,
  isNewDevice,
  listSessionsForUser,
  rememberDevice,
  revokeAllSessionsForUser,
  revokeSession,
  verifyCsrfToken,
} from "@app/auth";

import { FakeRedis } from "./support/fakeRedis";

describe("createSession cookie flags", () => {
  it("sets HttpOnly, Secure, and SameSite=Lax", async () => {
    const redis = new FakeRedis();
    const { cookie } = await createSession(redis, {
      userId: "user_1",
      roles: ["parent"],
      mfaVerifiedAt: null,
    });

    expect(cookie.httpOnly).toBe(true);
    expect(cookie.secure).toBe(true);
    expect(cookie.sameSite).toBe("lax");
    expect(cookie.path).toBe("/");
    expect(cookie.maxAge).toBeGreaterThan(0);
  });

  it("clears the cookie on logout", () => {
    const cookie = buildExpiredSessionCookie();
    expect(cookie.maxAge).toBe(0);
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.secure).toBe(true);
  });
});

describe("session lifetime by role", () => {
  it("gives an administrator a shorter lifetime than a parent", async () => {
    const redis = new FakeRedis();
    const parentSession = await createSession(redis, {
      userId: "u1",
      roles: ["parent"],
      mfaVerifiedAt: null,
    });
    const adminSession = await createSession(redis, {
      userId: "u2",
      roles: ["administrator"],
      mfaVerifiedAt: new Date(),
    });

    expect(adminSession.cookie.maxAge).toBeLessThan(parentSession.cookie.maxAge);
  });

  it("uses the shortest lifetime across an actor's combined roles", async () => {
    const redis = new FakeRedis();
    const combined = await createSession(redis, {
      userId: "u3",
      roles: ["parent", "super_administrator"],
      mfaVerifiedAt: new Date(),
    });
    const superAdminOnly = await createSession(redis, {
      userId: "u4",
      roles: ["super_administrator"],
      mfaVerifiedAt: new Date(),
    });

    expect(combined.cookie.maxAge).toBe(superAdminOnly.cookie.maxAge);
  });
});

describe("getSession / touchSession / revokeSession", () => {
  it("round-trips a created session", async () => {
    const redis = new FakeRedis();
    const { session } = await createSession(redis, {
      userId: "user_1",
      roles: ["tutor"],
      mfaVerifiedAt: null,
    });

    const fetched = await getSession(redis, session.id);
    expect(fetched?.userId).toBe("user_1");
    expect(fetched?.roles).toEqual(["tutor"]);
  });

  it("returns null for a session id that was never created", async () => {
    const redis = new FakeRedis();
    expect(await getSession(redis, "does-not-exist")).toBeNull();
  });

  it("revoking a session removes it and its membership in the user's session set", async () => {
    const redis = new FakeRedis();
    const { session } = await createSession(redis, {
      userId: "user_1",
      roles: ["parent"],
      mfaVerifiedAt: null,
    });

    await revokeSession(redis, session.id);

    expect(await getSession(redis, session.id)).toBeNull();
    expect(await listSessionsForUser(redis, "user_1")).toEqual([]);
  });
});

describe("revokeAllSessionsForUser (log out all devices)", () => {
  it("revokes every session for the user but leaves other users' sessions intact", async () => {
    const redis = new FakeRedis();
    const s1 = await createSession(redis, {
      userId: "user_1",
      roles: ["parent"],
      mfaVerifiedAt: null,
    });
    const s2 = await createSession(redis, {
      userId: "user_1",
      roles: ["parent"],
      mfaVerifiedAt: null,
    });
    const other = await createSession(redis, {
      userId: "user_2",
      roles: ["parent"],
      mfaVerifiedAt: null,
    });

    await revokeAllSessionsForUser(redis, "user_1");

    expect(await getSession(redis, s1.session.id)).toBeNull();
    expect(await getSession(redis, s2.session.id)).toBeNull();
    expect(await listSessionsForUser(redis, "user_1")).toEqual([]);
    expect(await getSession(redis, other.session.id)).not.toBeNull();
  });
});

describe("CSRF tokens", () => {
  it("accepts a token derived from the session's own secret", async () => {
    const redis = new FakeRedis();
    const { session } = await createSession(redis, {
      userId: "user_1",
      roles: ["parent"],
      mfaVerifiedAt: null,
    });
    const token = generateCsrfToken(session);

    expect(verifyCsrfToken(session, token)).toBe(true);
  });

  it("rejects a token from a different session", async () => {
    const redis = new FakeRedis();
    const { session: sessionA } = await createSession(redis, {
      userId: "user_1",
      roles: ["parent"],
      mfaVerifiedAt: null,
    });
    const { session: sessionB } = await createSession(redis, {
      userId: "user_2",
      roles: ["parent"],
      mfaVerifiedAt: null,
    });

    const tokenFromB = generateCsrfToken(sessionB);
    expect(verifyCsrfToken(sessionA, tokenFromB)).toBe(false);
  });

  it("rejects a tampered token without throwing", async () => {
    const redis = new FakeRedis();
    const { session } = await createSession(redis, {
      userId: "user_1",
      roles: ["parent"],
      mfaVerifiedAt: null,
    });

    expect(verifyCsrfToken(session, "not-a-real-token")).toBe(false);
    expect(verifyCsrfToken(session, "")).toBe(false);
  });
});

describe("new-device detection", () => {
  it("flags an unseen fingerprint as a new device, then remembers it", async () => {
    const redis = new FakeRedis();
    const fingerprint = deviceFingerprint("203.0.113.5", "Mozilla/5.0 Test");

    expect(await isNewDevice(redis, "user_1", fingerprint)).toBe(true);

    await rememberDevice(redis, "user_1", fingerprint);
    expect(await isNewDevice(redis, "user_1", fingerprint)).toBe(false);
  });

  it("treats a different IP/UA combination as a different device", async () => {
    const redis = new FakeRedis();
    const known = deviceFingerprint("203.0.113.5", "Mozilla/5.0 Test");
    await rememberDevice(redis, "user_1", known);

    const other = deviceFingerprint("198.51.100.9", "Mozilla/5.0 Test");
    expect(await isNewDevice(redis, "user_1", other)).toBe(true);
  });
});
