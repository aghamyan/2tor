import { generateCsrfToken, getSession, SESSION_COOKIE_NAME } from "@app/auth";
import { NextResponse, type NextRequest } from "next/server";

import { webRedis } from "../../../../lib/current-session";

/**
 * Issues the CSRF token `../route.ts`'s `POST` requires, derived from the caller's own session
 * (via `@app/auth`'s synchronizer-token pattern: `generateCsrfToken` is a one-way HMAC of the
 * session's server-only `csrfSecret`, never the secret itself). This is a same-origin, credentialed
 * GET — a cross-site page cannot read its JSON body without the server opting into CORS (which
 * this route does not), so a forged cross-site `POST /logout` still can't obtain a valid token to
 * present. Returns `{ csrfToken: null }` rather than an error when there's no session, so the
 * client-side logout flow stays simple (task requirement: logging out while already logged out
 * must not surface an error).
 */
export async function GET(request: NextRequest) {
  const sessionId = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = sessionId ? await getSession(webRedis(), sessionId) : null;
  const response = NextResponse.json({
    data: { csrfToken: session ? generateCsrfToken(session) : null },
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
