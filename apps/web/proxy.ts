import { NextResponse, type NextRequest } from "next/server";

/**
 * Middleware runs in the Edge Runtime, which disallows native bindings and most Node.js built-ins.
 * `@app/auth` and `@app/i18n` each expose a single package.json `exports` entry point (`"."`),
 * so importing even one named export pulls in their *entire* barrel — for `@app/auth` that
 * includes `argon2` (a native addon, via `password.ts`) and for `@app/i18n` that includes
 * `node:fs/promises` (via `getMessages.ts`). Either would break the Edge build. The few pure,
 * stable values needed here are therefore duplicated locally, each pointing back at its source of
 * truth so the two can be kept in sync:
 * - `SESSION_COOKIE_NAME` mirrors `packages/auth/src/session.ts`.
 * - `LOCALES`/`DEFAULT_LOCALE`/locale helpers mirror `packages/i18n/src/config.ts`.
 * Same reasoning applies to `@app/observability`'s `newRequestId` (pulls in `pino`): request IDs
 * use the Web Crypto global directly instead, which is exactly what `newRequestId()` does anyway.
 */
const SESSION_COOKIE_NAME = "session_id";

const LOCALES = ["en", "hy"] as const;
type Locale = (typeof LOCALES)[number];
const DEFAULT_LOCALE: Locale = "en";

function isLocale(value: string | undefined): value is Locale {
  return value !== undefined && (LOCALES as readonly string[]).includes(value);
}

function detectLocale(acceptLanguage: string | null): Locale {
  const candidates = (acceptLanguage ?? "")
    .split(",")
    .map((part) => {
      const [language, quality] = part.trim().split(";");
      return {
        language: language?.trim().toLowerCase().split("-")[0],
        quality: Number(quality?.match(/q=([\d.]+)/)?.[1] ?? 1),
      };
    })
    .sort((a, b) => b.quality - a.quality);

  for (const { language } of candidates) {
    if (isLocale(language)) return language;
  }
  return DEFAULT_LOCALE;
}

const LOCALE_COOKIE_NAME = "NEXT_LOCALE";
const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
const REQUEST_ID_HEADER = "x-request-id";
const LOCALE_HEADER = "x-locale";

/**
 * Paths (locale-stripped) reachable without a session — everything else under `(app)/*` is
 * deny-by-default, matching this codebase's authorization philosophy (see `@app/auth`'s README,
 * "Deny-by-default"). New public marketing pages are added to this list by hand; this is a
 * deliberately small, stable set (unlike nav registration, which the task requires to need no
 * central-file edits) since route groups are invisible at the URL/middleware layer.
 */
const PUBLIC_PATHS = new Set<string>([
  "/login",
  "/signup",
  "/home",
  "/how-it-works",
  "/mathematics",
  "/programming",
  "/armenian-language-heritage",
  "/sat",
  "/toefl",
  "/group-lessons",
  "/project-based-learning",
  "/parents",
  "/tutors",
  "/pricing",
  "/consultation",
  "/free-assessment",
  "/safety",
  "/privacy",
  "/faq",
  "/contact",
  "/terms",
  "/tutor-application",
]);

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 20;

/**
 * In-memory sliding-window limiter, keyed by client IP + path. Correct only for a single Node
 * process — it doesn't persist across restarts or coordinate across instances. Move this state
 * to Redis before horizontally scaling the public POST endpoints.
 */
const requestLog = new Map<string, number[]>();

function isRateLimited(key: string, now: number): boolean {
  const recent = (requestLog.get(key) ?? []).filter(
    (timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS,
  );
  recent.push(now);
  requestLog.set(key, recent);
  return recent.length > RATE_LIMIT_MAX_REQUESTS;
}

function clientIp(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

function stripLocale(pathname: string): { locale: Locale | undefined; rest: string } {
  const segments = pathname.split("/");
  const maybeLocale = segments[1];
  if (!isLocale(maybeLocale)) return { locale: undefined, rest: pathname };
  // `rest` always starts with "/" (e.g. "/en" -> "/", "/en/dashboard" -> "/dashboard").
  return { locale: maybeLocale, rest: `/${segments.slice(2).join("/")}` };
}

function generateNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}

/**
 * Next.js auto-applies this nonce to its own inline hydration/RSC-payload scripts, but only if it
 * can read the nonce back out of the *request's* `Content-Security-Policy` header (not just the
 * response's) — see https://nextjs.org/docs/app/guides/content-security-policy. Without
 * `'nonce-...'` here, every inline script Next injects (including the RSC payload bootstrap) is
 * blocked by `script-src 'self'`, which breaks hydration on every page.
 */
function buildCsp(nonce: string): string {
  // 'unsafe-eval' is dev-only: React's dev-mode debugging tools (stack-frame reconstruction) call
  // eval(), which it never does in production, so this must not leak into the production CSP.
  const scriptSrc =
    process.env.NODE_ENV === "production"
      ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`
      : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval'`;

  return [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    // Content resources embed only canonical YouTube video URLs (see
    // packages/domain/content/services.ts's videoEmbedUrl) — never arbitrary third-party frames.
    "frame-src https://www.youtube.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

function withSecurityHeaders(response: NextResponse, nonce: string): NextResponse {
  response.headers.set("Content-Security-Policy", buildCsp(nonce));
  response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-Content-Type-Options", "nosniff");
  return response;
}

const STATIC_FILE_PATTERN = /\.[^/]+$/;

export function proxy(request: NextRequest): NextResponse {
  const requestId = crypto.randomUUID();
  const nonce = generateNonce();
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/_next") || STATIC_FILE_PATTERN.test(pathname)) {
    return withSecurityHeaders(NextResponse.next(), nonce);
  }

  const isApiRoute = pathname.startsWith("/api");
  const hasSession = request.cookies.has(SESSION_COOKIE_NAME);

  // API routes are never locale-prefixed and authenticate/authorize themselves per
  // `docs/CONVENTIONS.md` ("authenticate -> authorize -> validate -> call service"); the shell
  // only attaches a request id, security headers, and rate limiting for unauthenticated POSTs.
  if (isApiRoute) {
    if (
      request.method === "POST" &&
      !hasSession &&
      isRateLimited(`${clientIp(request)}:${pathname}`, Date.now())
    ) {
      return withSecurityHeaders(new NextResponse("Too Many Requests", { status: 429 }), nonce);
    }
    const response = withSecurityHeaders(NextResponse.next(), nonce);
    response.headers.set(REQUEST_ID_HEADER, requestId);
    return response;
  }

  const { locale: pathLocale, rest: localeStrippedPath } = stripLocale(pathname);
  // A locale-prefixed request is rewritten to the route tree's unprefixed path below. Next runs
  // the proxy again for that internal request, carrying the locale header we attach. Recognizing
  // it prevents `/en/home -> /home -> /en/home` redirect loops while keeping authorization active
  // on both passes.
  const forwardedLocaleValue = request.headers.get(LOCALE_HEADER) ?? undefined;
  const forwardedLocale = isLocale(forwardedLocaleValue) ? forwardedLocaleValue : undefined;

  if (!pathLocale && !forwardedLocale) {
    const cookieLocale = request.cookies.get(LOCALE_COOKIE_NAME)?.value;
    const locale = isLocale(cookieLocale)
      ? cookieLocale
      : detectLocale(request.headers.get("accept-language"));
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
    const response = NextResponse.redirect(redirectUrl);
    response.cookies.set(LOCALE_COOKIE_NAME, locale, { path: "/", maxAge: LOCALE_COOKIE_MAX_AGE });
    return withSecurityHeaders(response, nonce);
  }

  const locale = pathLocale ?? forwardedLocale ?? DEFAULT_LOCALE;
  const rest = pathLocale ? localeStrippedPath : pathname;
  const isPublic = PUBLIC_PATHS.has(rest);

  // "Public POST endpoints": endpoints reachable without a session — the classic brute-force /
  // spam target (login, signup, contact forms). Authenticated POSTs are left to each domain
  // module's own authorization + any additional rate limiting it needs.
  if (
    request.method === "POST" &&
    !hasSession &&
    isRateLimited(`${clientIp(request)}:${rest}`, Date.now())
  ) {
    return withSecurityHeaders(new NextResponse("Too Many Requests", { status: 429 }), nonce);
  }

  if (!isPublic && !hasSession) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = `/${locale}/login`;
    loginUrl.search = `?next=${encodeURIComponent(rest)}`;
    return withSecurityHeaders(NextResponse.redirect(loginUrl), nonce);
  }

  // Coarse, cookie-presence gate only: it keeps the proxy Edge-safe (no Redis session lookup
  // available here — see the file-level note) and matches the recommended Next.js pattern of a
  // cheap proxy redirect backed by an authoritative, server-side `authorize()` check deeper
  // in the tree (`@app/auth`'s `authorize()`, wrapped by `./lib/role-guard.ts`) once a domain
  // module can actually resolve the session against Redis.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(REQUEST_ID_HEADER, requestId);
  requestHeaders.set(LOCALE_HEADER, locale);
  // Next.js reads the nonce back out of the request's own CSP header to auto-nonce its inline
  // hydration scripts — see the `buildCsp` comment above.
  requestHeaders.set("Content-Security-Policy", buildCsp(nonce));

  let response: NextResponse;
  if (pathLocale) {
    const rewriteUrl = request.nextUrl.clone();
    rewriteUrl.pathname = rest;
    response = NextResponse.rewrite(rewriteUrl, { request: { headers: requestHeaders } });
  } else {
    response = NextResponse.next({ request: { headers: requestHeaders } });
  }
  response.headers.set(REQUEST_ID_HEADER, requestId);
  return withSecurityHeaders(response, nonce);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
