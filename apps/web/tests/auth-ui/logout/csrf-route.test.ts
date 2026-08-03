import { createSession, generateCsrfToken } from "@app/auth";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FakeRedis } from "../../auth/support/fakeRedis";

const state = vi.hoisted(() => ({ redis: undefined as FakeRedis | undefined }));

vi.mock("../../../lib/current-session", () => ({
  webRedis: () => state.redis,
}));

import { GET } from "../../../app/(auth)/logout/csrf/route";

function testRedis(): FakeRedis {
  if (!state.redis) throw new Error("test setup error: redis not initialized");
  return state.redis;
}

describe("GET /(auth)/logout/csrf", () => {
  beforeEach(() => {
    state.redis = new FakeRedis();
  });

  it("returns a token matching the session's synchronizer token when a session exists", async () => {
    const { session } = await createSession(testRedis(), { userId: "user_1", roles: ["parent"] });
    const request = new NextRequest("https://app.example.test/logout/csrf", {
      headers: { cookie: `session_id=${session.id}` },
    });

    const response = await GET(request);
    const body = (await response.json()) as { data: { csrfToken: string | null } };

    expect(body.data.csrfToken).toBe(generateCsrfToken(session));
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("returns a null token, not an error, when there is no session", async () => {
    const request = new NextRequest("https://app.example.test/logout/csrf");

    const response = await GET(request);
    const body = (await response.json()) as { data: { csrfToken: string | null } };

    expect(response.status).toBe(200);
    expect(body.data.csrfToken).toBeNull();
  });

  it("never leaks the session's csrfSecret", async () => {
    const { session } = await createSession(testRedis(), { userId: "user_1", roles: ["parent"] });
    const request = new NextRequest("https://app.example.test/logout/csrf", {
      headers: { cookie: `session_id=${session.id}` },
    });

    const response = await GET(request);
    const rawBody = await response.text();

    expect(rawBody).not.toContain(session.csrfSecret);
  });
});
