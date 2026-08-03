import {
  buildExpiredSessionCookie,
  getSession,
  revokeSession,
  verifyCsrfToken,
  type RedisLike,
  type SessionRecord,
} from "@app/auth";

/**
 * A local copy of `@app/i18n/config`'s two-element locale set, not an import of it. `@app/i18n`'s
 * package.json only declares a `"."` `exports` entry (see `packages/i18n/package.json`); Next.js's
 * bundler resolves the deep path `@app/i18n/config` anyway via `tsconfig.base.json`'s `paths` map
 * (see `apps/web/app/layout.tsx`'s file-level comment for the same trick used for the same
 * reason), but Vitest's resolver honors the `exports` field strictly and has no such mapping
 * configured (`apps/web/vitest.config.ts` is outside this task's file scope), so that deep import
 * fails at test time even though it works in the real app. Mirrors `apps/web/proxy.ts`'s own
 * `SESSION_COOKIE_NAME`/`LOCALES` local copies — same trick, different constraint (Edge Runtime
 * there, Vitest module resolution here) — each pointing back at its source of truth so the two
 * stay in sync by inspection.
 */
const LOCALES = ["en", "hy"] as const;
type Locale = (typeof LOCALES)[number];
const DEFAULT_LOCALE: Locale = "en";

function isLocale(value: string | undefined | null): value is Locale {
  return value !== undefined && value !== null && (LOCALES as readonly string[]).includes(value);
}

/** Unprefixed pathname of the post-logout landing page — see `../signed-out/page.tsx`. */
export const SIGNED_OUT_PATH = "/signed-out";

/** Roles whose logout gets an audit row (spec/task requirement: staff logouts are audited). */
const STAFF_ROLES = new Set(["finance", "administrator", "super_administrator"]);

export function isStaffSession(session: Pick<SessionRecord, "roles">): boolean {
  return session.roles.some((role) => STAFF_ROLES.has(role));
}

export type LogoutOutcome =
  | { kind: "already_signed_out" }
  | { kind: "csrf_rejected" }
  | { kind: "signed_out"; session: SessionRecord };

/**
 * Pure decision: given the session named by the request's cookie (already looked up by the
 * caller) and the CSRF token submitted with the request, decide what should happen. No I/O here —
 * `performLogout` below does the actual Redis/audit work once this has decided it's safe to.
 *
 * A `null` session (no cookie, or a cookie naming a session that's already gone) is treated as
 * success, not an error: logout must be idempotent (task requirement — double-clicking, or
 * re-submitting after the cookie was already cleared, must not surface an error page).
 */
export function resolveLogoutOutcome(
  session: SessionRecord | null,
  submittedCsrfToken: string | null,
): LogoutOutcome {
  if (!session) return { kind: "already_signed_out" };
  if (!submittedCsrfToken || !verifyCsrfToken(session, submittedCsrfToken)) {
    return { kind: "csrf_rejected" };
  }
  return { kind: "signed_out", session };
}

export interface LogoutAuditPort {
  recordStaffLogout(input: { userId: string; sessionId: string; ipAddress: string | null }): Promise<void>;
}

export interface LogoutDeps {
  redis: RedisLike;
  audit: LogoutAuditPort;
}

export interface LogoutInput {
  /** The `session_id` cookie value read off the request, or `null` if absent. */
  sessionId: string | null;
  /** The CSRF token submitted with the request (header), or `null` if absent. */
  csrfToken: string | null;
  ipAddress: string | null;
}

export interface LogoutResult {
  outcome: LogoutOutcome;
}

/**
 * The actual logout side effect. Order matters (task requirement #2): the Redis session record
 * is deleted BEFORE this function returns success, so a caller that then clears the cookie never
 * produces a state where the cookie is gone but the server-side session is still live, or vice
 * versa in a way that matters (a cleared cookie with a still-live session would be the bug this
 * ordering prevents).
 */
export async function performLogout(deps: LogoutDeps, input: LogoutInput): Promise<LogoutResult> {
  const session = input.sessionId ? await getSession(deps.redis, input.sessionId) : null;
  const outcome = resolveLogoutOutcome(session, input.csrfToken);

  if (outcome.kind === "signed_out") {
    await revokeSession(deps.redis, outcome.session.id);
    if (isStaffSession(outcome.session)) {
      await deps.audit.recordStaffLogout({
        userId: outcome.session.userId,
        sessionId: outcome.session.id,
        ipAddress: input.ipAddress,
      });
    }
  }

  return { outcome };
}

/**
 * Cookie-clear attributes for the `session_id` cookie. `name`/`httpOnly`/`sameSite`/`path`/
 * `maxAge` come straight from `@app/auth`'s `buildExpiredSessionCookie()`; `secure` is computed
 * the same way `apps/web/app/api/auth/login/route.ts` computes it when *setting* the cookie
 * (`process.env.NODE_ENV === "production"`, not the literal `true` `buildExpiredSessionCookie`
 * assumes) — task requirement #3 is exact-attribute match, and login's cookie is the one actually
 * written to the browser, so this must mirror login, not `@app/auth`'s literal default.
 */
export function expiredSessionCookieAttributes(nodeEnv: string | undefined) {
  const expired = buildExpiredSessionCookie();
  return {
    name: expired.name,
    value: expired.value,
    httpOnly: expired.httpOnly,
    sameSite: expired.sameSite,
    path: expired.path,
    maxAge: expired.maxAge,
    secure: nodeEnv === "production",
  };
}

/** Prefers the proxy-set `x-locale` request header; falls back to the `NEXT_LOCALE` cookie, then the default locale. */
export function resolveRedirectLocale(
  headerLocale: string | null,
  cookieLocale: string | null,
): Locale {
  if (isLocale(headerLocale)) return headerLocale;
  if (isLocale(cookieLocale)) return cookieLocale;
  return DEFAULT_LOCALE;
}

export function buildSignedOutPath(locale: Locale): string {
  return `/${locale}${SIGNED_OUT_PATH}`;
}
