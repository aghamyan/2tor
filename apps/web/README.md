# `apps/web`

The Next.js application shell: root layout, providers, locale-prefixed routing, auth + security
proxy, the two top-level route groups, and a bundled navigation registry. This
README documents the shell layer only — a domain module's own README (once one exists) documents
that module's routes, services, and messages.

## Route groups

| Group              | Layout                   | Purpose                                                                                                                  |
| ------------------ | ------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `app/(app)/`       | `(app)/layout.tsx`       | Authenticated shell: role-filtered nav sidebar + content area. `proxy.ts` requires a session cookie for everything here. |
| `app/(marketing)/` | `(marketing)/layout.tsx` | Public pages: marketing content, `/login`, `/signup`. No nav registry, no auth gate.                                     |

Route groups don't add a path segment, so `(app)/page.tsx` and a hypothetical `(marketing)/page.tsx`
would both resolve to `/` and fail to build — `/` is the authenticated entry point
(`(app)/page.tsx`); marketing content lives at named paths under `(marketing)/`.

Per `docs/CONVENTIONS.md`, a domain module owns its own `apps/web/app/(app)/<module>/` (and
`api/<module>/`) folder; adding one is entirely that module's concern and requires no edit here.

## Locale-prefixed routing

There is no `app/[locale]/` segment. Instead:

1. A request with no locale prefix (e.g. `/dashboard`) is **redirected** to a prefixed URL
   (`/en/dashboard`), chosen from the `NEXT_LOCALE` cookie, then `Accept-Language`, then the
   default locale (`en`).
2. A request already prefixed (e.g. `/en/dashboard`) is **rewritten** internally to the
   unprefixed path (`/dashboard`, which is where the actual page file lives) and the resolved
   locale is attached to the request as an `x-locale` header.
3. `app/layout.tsx` reads that header (via `next/headers`) to pick the interface locale, load its
   messages (`@app/i18n`'s `getMessages`), and render `<html lang>` — all server-side.

Supported locales (`en`, `hy`) and the default (`en`) mirror `packages/i18n/src/config.ts`.

## Providers

`app/providers.tsx` composes:

- **i18n**: `NextIntlClientProvider` (from `next-intl` directly — see "Known constraints" below
  for why not `@app/i18n`'s `I18nProvider` wrapper).
- **theme**: a small custom context (`useTheme()`) that toggles the `.dark` class (see
  `packages/ui/src/theme/tokens.css`) and persists the choice in a `theme` cookie, read back by
  `app/layout.tsx` on the next request to avoid a flash of the wrong theme.

There is **no query/data-fetching provider** (e.g. TanStack Query). No such library is among
`apps/web`'s dependencies, and adding one means editing `apps/web/package.json`, out of scope for
this shell task. A pass-through placeholder would be an empty abstraction with nothing to
compose, so it's omitted rather than stubbed — add a real provider here once a query library is
actually a dependency.

## Nav registry (`lib/nav-registry.ts`)

Production bundles use static imports for each domain navigation item so Next/Turbopack can include
them reliably. In tests, `discoverNavItems()` also supports filesystem discovery for registry
contract coverage:

```ts
// packages/domain/billing/nav.ts

// Shape matches apps/web/lib/nav-registry.ts's NavItem: { id, label, href, roles }. Not imported
// from apps/web here — apps/* depending on packages/* is the normal direction, not the reverse.
export default {
  id: "billing.dashboard",
  label: "billing.nav.dashboard", // an @app/i18n message key, not raw text
  href: "/billing",
  roles: ["finance", "administrator"], // empty array = visible to any authenticated actor
};
```

The authenticated layout resolves the Redis session and filters all registered items with
`filterNavByRole` before rendering.

## Role guard (`lib/role-guard.ts`)

A thin wrapper over `@app/auth`'s `authorize()`, plus `canViewNavItem`/`filterNavByRole` for
narrowing nav items by role. It takes an already-resolved `Actor` as a parameter — it does not
fetch a session itself (see "Known constraints": no Redis client here).

## Request proxy (`proxy.ts`)

Runs in the Edge Runtime and, per request:

1. Attaches an `x-request-id` header (`crypto.randomUUID()`).
2. Handles locale redirect/rewrite (above).
3. Rate-limits unauthenticated POST requests (in-memory; see "Known constraints").
4. Redirects an unauthenticated request to a protected path to `/<locale>/login?next=<path>`.
   `PUBLIC_PATHS` contains `/login`, `/signup`, and the public marketing slugs. It is a deliberately hand-maintained
   allowlist — route groups are invisible at this layer, so this is the one place in the shell
   that _does_ need a central list, unlike nav registration.
5. Sets security headers on every response: `Content-Security-Policy`, `Strict-Transport-Security`,
   `X-Frame-Options: DENY`, `Referrer-Policy`, `X-Content-Type-Options`.

`/api/*` requests skip locale handling (never locale-prefixed) but still get a request id,
security headers, and the same unauthenticated-POST rate limiting; authentication/authorization
for API routes is each route's own responsibility per `docs/CONVENTIONS.md`.

**The proxy auth gate is a coarse, cookie-presence check only.** The authenticated layout resolves
that session against Redis for role-filtered navigation, while page and route authorization
remains authoritative for protected resources and actions.

## Known constraints

The public-POST rate limiter in `proxy.ts` is an in-memory sliding window. Move it to Redis before
running multiple web instances.

- **The proxy avoids the `@app/auth` and `@app/i18n` barrels entirely.** Both packages expose a
  single package.json `exports` entry (`"."`), so importing even one named export pulls in the
  whole barrel — for `@app/auth` that includes `argon2` (a native addon, via `password.ts`), and
  for `@app/i18n` that includes `node:fs/promises` (via `getMessages.ts`). Either breaks the Edge
  Runtime build. `SESSION_COOKIE_NAME` and the locale helpers (`isLocale`/`detectLocale`/etc.) are
  therefore small, pure, duplicated logic in `proxy.ts`, each commented with a pointer back
  to its source of truth (`packages/auth/src/session.ts`, `packages/i18n/src/config.ts`) to keep
  them in sync. The same reasoning applies to `@app/observability`'s `newRequestId()` (pulls in
  `pino`) — `crypto.randomUUID()` is used directly instead, which is exactly what that function
  does internally.
- **`app/layout.tsx` and `app/providers.tsx` import `@app/i18n/config` and `@app/i18n/getMessages`
  directly, not the `@app/i18n` barrel.** `packages/i18n/src/index.ts` also re-exports
  `provider.tsx`, which has a pre-existing type error (missing `react`/`@types/react` — already
  documented in `docs/INFRA.md`) unrelated to this task and out of scope to fix. Importing the
  specific files needed avoids `tsc` ever type-checking `provider.tsx`; `apps/web`'s own
  `tsc --noEmit` is clean as a result. This relies on `tsconfig.base.json`'s existing
  `"@app/i18n/*"` path mapping, which resolves straight to source files independent of the
  package's `exports` map.
- **No query/data-fetching provider** — see "Providers" above.

## Testing

`apps/web/tests/shell/`:

- `nav-registry.test.ts` — proves a `packages/domain/foo/nav.ts` fixture is picked up with no
  shell edits, that a malformed default export is ignored, and cleans up its fixture directories
  in `afterEach` (runs even on assertion failure, so a failed run can't leave `packages/domain/*`
  dirty).
- `middleware.test.ts` — asserts the proxy security headers, the no-locale-prefix redirect, the
  unauthenticated-protected-path redirect to `/login`, and that a session cookie / public path
  both let a request through without redirecting.

Run with `pnpm --filter web test` (or `pnpm test` from the repo root).
