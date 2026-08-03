import { describe, expect, it, vi } from "vitest";

import { performClientLogout } from "../../../components/auth/logout/perform-client-logout";

function firstCallOrder(mockFn: { mock: { invocationCallOrder: number[] } }): number {
  const [order] = mockFn.mock.invocationCallOrder;
  if (order === undefined) throw new Error("expected mock to have been called");
  return order;
}

function jsonResponse(body: unknown, ok = true): Response {
  return new Response(JSON.stringify(body), {
    status: ok ? 200 : 500,
    headers: { "content-type": "application/json" },
  });
}

describe("performClientLogout", () => {
  it("fetches a CSRF token, posts it, tears down client state, and navigates to redirectTo on success", async () => {
    const calls: string[] = [];
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push(`${init?.method ?? "GET"} ${url}`);
      if (url.endsWith("/logout/csrf")) return jsonResponse({ data: { csrfToken: "tok_123" } });
      return jsonResponse({ data: { redirectTo: "/en/signed-out" } });
    });
    const closeAllConnections = vi.fn();
    const broadcastLogout = vi.fn();
    const navigate = vi.fn();

    const result = await performClientLogout({
      fetchImpl,
      closeAllConnections,
      broadcastLogout,
      navigate,
      localePrefix: () => "/en",
    });

    expect(result).toEqual({ ok: true });
    expect(calls).toEqual(["GET /en/logout/csrf", "POST /en/logout"]);

    // The POST must carry the token fetched from the CSRF endpoint.
    const postCall = fetchImpl.mock.calls[1];
    const postHeaders = postCall?.[1]?.headers as Headers;
    expect(postHeaders.get("x-csrf-token")).toBe("tok_123");

    // Teardown happens before navigating away, in this order.
    expect(closeAllConnections).toHaveBeenCalledTimes(1);
    expect(broadcastLogout).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith("/en/signed-out");
    const navigateOrder = firstCallOrder(navigate);
    expect(firstCallOrder(closeAllConnections)).toBeLessThan(navigateOrder);
    expect(firstCallOrder(broadcastLogout)).toBeLessThan(navigateOrder);
  });

  it("does not tear down state or navigate when the server rejects the logout POST", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith("/logout/csrf")) return jsonResponse({ data: { csrfToken: null } });
      return jsonResponse({ error: { code: "CSRF_INVALID" } }, false);
    });
    const closeAllConnections = vi.fn();
    const broadcastLogout = vi.fn();
    const navigate = vi.fn();

    const result = await performClientLogout({
      fetchImpl,
      closeAllConnections,
      broadcastLogout,
      navigate,
      localePrefix: () => "/en",
    });

    expect(result).toEqual({ ok: false });
    expect(closeAllConnections).not.toHaveBeenCalled();
    expect(broadcastLogout).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("reports failure rather than throwing when the network request itself fails", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("network down");
    });

    const result = await performClientLogout({
      fetchImpl,
      closeAllConnections: vi.fn(),
      broadcastLogout: vi.fn(),
      navigate: vi.fn(),
      localePrefix: () => "/en",
    });

    expect(result).toEqual({ ok: false });
  });

  it("still posts (without a token header) when the CSRF endpoint itself fails, matching the idempotent already-signed-out path", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith("/logout/csrf")) return jsonResponse({}, false);
      const headers = init?.headers as Headers;
      expect(headers.has("x-csrf-token")).toBe(false);
      return jsonResponse({ data: { redirectTo: "/hy/signed-out" } });
    });

    const result = await performClientLogout({
      fetchImpl,
      closeAllConnections: vi.fn(),
      broadcastLogout: vi.fn(),
      navigate: vi.fn(),
      localePrefix: () => "/hy",
    });

    expect(result).toEqual({ ok: true });
  });
});
