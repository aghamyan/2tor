import { createSession, generateCsrfToken, getSession, type SessionRecord } from "@app/auth";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as routeModule from "../../../app/(auth)/logout/route";
import { FakeRedis } from "../../auth/support/fakeRedis";

interface StaffAuditCall {
  userId: string;
  sessionId: string;
  ipAddress: string | null;
}

const state = vi.hoisted(() => ({
  redis: undefined as FakeRedis | undefined,
  staffAuditCalls: [] as StaffAuditCall[],
}));

vi.mock("../../../app/(auth)/logout/runtime", () => ({
  logoutDeps: () => ({
    redis: state.redis,
    audit: {
      async recordStaffLogout(input: StaffAuditCall) {
        state.staffAuditCalls.push(input);
      },
    },
  }),
}));

const { POST } = routeModule;

function postRequest(options: {
  sessionId?: string;
  csrfToken?: string;
  localeHeader?: string;
  localeCookie?: string;
}): NextRequest {
  const cookieParts: string[] = [];
  if (options.sessionId) cookieParts.push(`session_id=${options.sessionId}`);
  if (options.localeCookie) cookieParts.push(`NEXT_LOCALE=${options.localeCookie}`);

  const headers = new Headers();
  if (cookieParts.length > 0) headers.set("cookie", cookieParts.join("; "));
  if (options.csrfToken) headers.set("x-csrf-token", options.csrfToken);
  if (options.localeHeader) headers.set("x-locale", options.localeHeader);

  return new NextRequest("https://app.example.test/logout", { method: "POST", headers });
}

function testRedis(): FakeRedis {
  if (!state.redis) throw new Error("test setup error: redis not initialized");
  return state.redis;
}

async function createTestSession(userId: string, roles: SessionRecord["roles"]) {
  return createSession(testRedis(), { userId, roles });
}

describe("POST /(auth)/logout", () => {
  beforeEach(() => {
    state.redis = new FakeRedis();
    state.staffAuditCalls = [];
  });

  it("does not export a GET handler — a GET/prefetch/crawler can never end a session here", () => {
    expect("GET" in routeModule).toBe(false);
  });

  it("destroys the server-side session, clears the cookie with matching attributes, and redirects locale-preserving", async () => {
    const { session } = await createTestSession("user_1", ["parent"]);
    const token = generateCsrfToken(session);

    const response = await POST(
      postRequest({ sessionId: session.id, csrfToken: token, localeHeader: "hy" }),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { data: { redirectTo: string } };
    expect(body.data.redirectTo).toBe("/hy/signed-out");
    expect(await getSession(testRedis(), session.id)).toBeNull();

    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toMatch(/session_id=;/);
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=lax/i);
    expect(setCookie).toMatch(/Path=\//i);
    expect(setCookie).toMatch(/Max-Age=0/i);
    expect(response.headers.get("Cache-Control")).toBe("no-store");

    // Sensitive-data hygiene: the session id itself never appears in the redirect or response body.
    const rawBody = JSON.stringify(body);
    expect(rawBody).not.toContain(session.id);
  });

  it("rejects a POST with a missing CSRF token and leaves the session intact", async () => {
    const { session } = await createTestSession("user_1", ["parent"]);

    const response = await POST(postRequest({ sessionId: session.id }));

    expect(response.status).toBe(403);
    expect(await getSession(testRedis(), session.id)).not.toBeNull();
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("rejects a POST with a forged CSRF token and leaves the session intact", async () => {
    const { session } = await createTestSession("user_1", ["parent"]);

    const response = await POST(postRequest({ sessionId: session.id, csrfToken: "forged" }));

    expect(response.status).toBe(403);
    expect(await getSession(testRedis(), session.id)).not.toBeNull();
  });

  it("is idempotent across two POSTs in a row, both landing on /signed-out", async () => {
    const { session } = await createTestSession("user_1", ["parent"]);
    const token = generateCsrfToken(session);

    const first = await POST(postRequest({ sessionId: session.id, csrfToken: token }));
    expect(first.status).toBe(200);

    // The second request simulates a double-click or a resubmission after the browser already
    // dropped the cookie: no session cookie is sent at all.
    const second = await POST(postRequest({}));
    expect(second.status).toBe(200);
    const secondBody = (await second.json()) as { data: { redirectTo: string } };
    expect(secondBody.data.redirectTo).toBe("/en/signed-out");
  });

  it("falls back to the NEXT_LOCALE cookie, then the default locale, when x-locale is absent", async () => {
    const { session } = await createTestSession("user_1", ["parent"]);
    const token = generateCsrfToken(session);

    const response = await POST(
      postRequest({ sessionId: session.id, csrfToken: token, localeCookie: "hy" }),
    );
    const body = (await response.json()) as { data: { redirectTo: string } };
    expect(body.data.redirectTo).toBe("/hy/signed-out");
  });

  it("audits a staff logout but not an ordinary user's", async () => {
    const staff = await createTestSession("staff_1", ["administrator"]);
    await POST(
      postRequest({ sessionId: staff.session.id, csrfToken: generateCsrfToken(staff.session) }),
    );
    expect(state.staffAuditCalls).toEqual([
      { userId: "staff_1", sessionId: staff.session.id, ipAddress: null },
    ]);

    state.staffAuditCalls = [];
    const parent = await createTestSession("user_2", ["parent"]);
    await POST(
      postRequest({ sessionId: parent.session.id, csrfToken: generateCsrfToken(parent.session) }),
    );
    expect(state.staffAuditCalls).toEqual([]);
  });
});
