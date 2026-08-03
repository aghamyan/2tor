import { SESSION_COOKIE_NAME } from "@app/auth";
import { NextResponse, type NextRequest } from "next/server";

import {
  buildSignedOutPath,
  expiredSessionCookieAttributes,
  performLogout,
  resolveRedirectLocale,
} from "./logic";
import { logoutDeps } from "./runtime";

const CSRF_HEADER = "x-csrf-token";
const LOCALE_HEADER = "x-locale";
const LOCALE_COOKIE_NAME = "NEXT_LOCALE";

function requestIp(request: NextRequest): string | null {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
}

/**
 * Logout is a route handler, not a server action, so it has a plain HTTP surface: no `GET` is
 * exported below (a prefetch, crawler, or bare `<a href>` hitting this path with `GET` gets
 * Next's default 405, never reaching `performLogout`), and `POST` requires the CSRF token
 * `@app/auth`'s synchronizer-token pair (`generateCsrfToken`/`verifyCsrfToken`) protects — see
 * `./csrf/route.ts`, which is the only place that token is issued.
 *
 * Responds with JSON rather than an HTTP redirect (matching `api/auth/login/route.ts`'s existing
 * client-driven-navigation pattern) so the caller controls exactly when the browser navigates —
 * needed for the tab-broadcast / realtime-teardown steps `components/auth/logout/logout-button.tsx`
 * runs before it does.
 */
export async function POST(request: NextRequest) {
  const sessionId = request.cookies.get(SESSION_COOKIE_NAME)?.value ?? null;
  const csrfToken = request.headers.get(CSRF_HEADER);

  const { outcome } = await performLogout(logoutDeps(), {
    sessionId,
    csrfToken,
    ipAddress: requestIp(request),
  });

  if (outcome.kind === "csrf_rejected") {
    const response = NextResponse.json(
      { error: { code: "CSRF_INVALID", message: "The logout request could not be verified." } },
      { status: 403 },
    );
    response.headers.set("Cache-Control", "no-store");
    return response;
  }

  const locale = resolveRedirectLocale(
    request.headers.get(LOCALE_HEADER),
    request.cookies.get(LOCALE_COOKIE_NAME)?.value ?? null,
  );
  const response = NextResponse.json({ data: { redirectTo: buildSignedOutPath(locale) } });
  const cookie = expiredSessionCookieAttributes(process.env.NODE_ENV);
  response.cookies.set(cookie.name, cookie.value, {
    httpOnly: cookie.httpOnly,
    secure: cookie.secure,
    sameSite: cookie.sameSite,
    path: cookie.path,
    maxAge: cookie.maxAge,
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
