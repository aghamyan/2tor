import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { proxy } from "../../proxy";

function request(
  url: string,
  init: { cookie?: string; headers?: HeadersInit; method?: string } = {},
): NextRequest {
  const headers = new Headers(init.headers);
  if (init.cookie) headers.set("cookie", init.cookie);
  return new NextRequest(new URL(url, "https://example.test"), { method: init.method, headers });
}

function requireLocation(response: Response): URL {
  const location = response.headers.get("location");
  expect(location).not.toBeNull();
  return new URL(location as string);
}

describe("middleware", () => {
  it("sets the core security headers on every response", () => {
    const response = proxy(request("/en/login"));

    expect(response.headers.get("Content-Security-Policy")).toContain("default-src 'self'");
    expect(response.headers.get("Strict-Transport-Security")).toContain("max-age=");
    expect(response.headers.get("X-Frame-Options")).toBe("DENY");
    expect(response.headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("redirects a request with no locale prefix to a locale-prefixed URL", () => {
    const response = proxy(request("/dashboard"));

    expect(response.status).toBe(307);
    expect(requireLocation(response).pathname).toBe("/en/dashboard");
  });

  it("redirects an unauthenticated user off a protected (app)/* path to login", () => {
    const response = proxy(request("/en/dashboard"));

    expect(response.status).toBe(307);
    const location = requireLocation(response);
    expect(location.pathname).toBe("/en/login");
    expect(location.searchParams.get("next")).toBe("/dashboard");
  });

  it("lets an authenticated user through to a protected path", () => {
    const response = proxy(request("/en/dashboard", { cookie: "session_id=abc123" }));

    expect(response.status).not.toBe(307);
    expect(response.headers.get("location")).toBeNull();
  });

  it("lets an unauthenticated user reach a public path without redirecting to login", () => {
    const response = proxy(request("/en/login"));

    expect(response.headers.get("location")).toBeNull();
  });

  it("does not redirect the locale-carrying internal rewrite back to its prefixed path", () => {
    const response = proxy(request("/home", { headers: { "x-locale": "en" } }));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it.each(["/home", "/consultation", "/privacy", "/tutor-application"])(
    "lets an unauthenticated user reach the public marketing path %s",
    (path) => {
      const response = proxy(request(`/en${path}`));

      expect(response.headers.get("location")).toBeNull();
    },
  );
});
