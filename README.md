# 2tor

A modular-monolith tutoring platform. pnpm workspaces + Turborepo, Next.js (App Router) on
the frontend, a standalone BullMQ worker for background jobs, and PostgreSQL via Drizzle ORM.

See [docs/CONVENTIONS.md](docs/CONVENTIONS.md) for the engineering rules (security, i18n,
testing, accessibility) that apply to every change in this repo.

## Stack

Next.js · TypeScript (strict) · PostgreSQL 16 + Drizzle ORM · Redis + BullMQ · S3-compatible
storage (MinIO locally) · Stripe · next-intl · Tailwind CSS v4 + shadcn/ui · Zod · Vitest ·
Playwright.

## Repository layout

```
apps/
  web/                 Next.js app — routes, pages, API handlers, UI composition
  worker/               BullMQ job consumers (background processing)
packages/
  db/                   Drizzle schema, migrations, DB client factory
  auth/                 Password hashing, session/authorization primitives
  ui/                    Shared shadcn/Radix component library
  config/                Typed env/config loading (Zod-validated)
  i18n/                  next-intl setup + packages/i18n/messages/<locale>/<module>.json
  validation/            Shared Zod schemas
  domain/                Business logic: services that take a DB handle + typed input
  email/                 Email composition/sending
  observability/         Logging (pino) + Sentry helpers
  notifications/         Queue-backed notification dispatch
docs/
  CONVENTIONS.md         Engineering conventions (read this first)
```

Every package resolves via a stable alias (`@app/db`, `@app/auth`, `@app/ui`, `@app/config`,
`@app/i18n`, `@app/validation`, `@app/domain`, `@app/email`, `@app/observability`,
`@app/notifications`) — declared both as pnpm workspace dependencies (the mechanism that
actually resolves imports at build/test time) and as `paths` in `tsconfig.base.json` (for
editor tooling). Packages export raw TypeScript from `src/index.ts` directly — there is no
per-package `dist/` build step. `apps/web` consumes them via Next's `transpilePackages`.

## Folder-ownership model (for parallel agents)

This repo is designed so two agents can work simultaneously without touching the same files.
Per [docs/CONVENTIONS.md](docs/CONVENTIONS.md), a **module** (e.g. `scheduling`, `billing`,
`messaging`) owns a fixed slice across the tree:

- `packages/domain/<module>` — business logic
- `apps/web/app/(app)/<module>` and `apps/web/app/api/<module>` — pages + routes
- `apps/web/components/<module>` — module-specific UI
- `apps/worker/src/jobs/<module>` — background jobs
- `packages/i18n/messages/<locale>/<module>.json` — translated strings
- `apps/web/tests/<module>` — tests

**A module must never modify another module's folders, `packages/db` (schema), `packages/ui`
(shared components), `packages/auth`, `packages/config`, or any `package.json`.** This last
rule is why this scaffolding task installs the complete dependency set up front — feature work
should never need a `package.json` edit; every dependency a module will plausibly need is
already declared on the package that owns that concern (see `pnpm-workspace.yaml`'s `catalog:`
for the single source of truth on versions).

Two agents working on different modules in parallel should therefore never produce a merge
conflict outside of shared, append-only files (like the i18n message tree, where each module
owns its own JSON file).

## Getting started

```bash
corepack enable
cp .env.example .env
pnpm install --frozen-lockfile
docker compose up -d --wait
pnpm --filter @app/db db:migrate
pnpm --filter @app/db seed
pnpm dev
```

The Compose stack starts PostgreSQL, Redis, MinIO, and the local reverse proxy. After seeding,
the parent demo account is `parent@example.com` with password `DemoLogin!2026` (development only).
Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` before submitting changes.

## Notable deviations from the literal task spec

- **`eslint.config.mjs` instead of `.eslintrc.cjs`.** ESLint 10 (the current major) dropped
  legacy `.eslintrc` support entirely — only flat config works. Using `.eslintrc.cjs` would
  silently not be picked up and `pnpm turbo run lint` would fail everywhere.
- **ESLint pinned to `^9.39.5`, not the `10.x` latest.** `eslint-config-next` transitively
  pulls in `eslint-plugin-react@7.37.5`, which still calls `context.getFilename()` — an API
  ESLint 10 removed outright. This throws on every `apps/web` lint run under ESLint 10.
  Pinned to 9.x (still flat-config, still current) until upstream catches up.
- **TypeScript pinned to `^5.9.3`, not the `7.x` latest.** TypeScript 7 is the new native
  (Go-based) compiler; `typescript-eslint` (and therefore `eslint-config-next`) only supports
  `typescript >=4.8.4 <6.1.0` today. Pinning to 5.9 keeps lint/typecheck/drizzle-kit working
  together.
- **`eslint-config-next`'s flat configs are imported directly**, not through
  `@eslint/eslintrc`'s `FlatCompat`. `eslint-config-next@16` already ships native flat-config
  arrays; running an already-flat config through `FlatCompat` (which expects legacy
  `.eslintrc`-shaped input) throws a circular-JSON error inside `eslint-plugin-react`'s config
  object.
- **No `rootDir` in any package/app `tsconfig.json`.** Don't add one. Packages export raw
  `.ts` from `src/`, so the moment one package imports another (e.g. `apps/worker` importing
  `@app/domain`), `tsc` pulls the imported package's source into the compiling program — and
  `rootDir` requires every file in the program to live under it. Setting `rootDir: "src"` (the
  first thing you'd reach for) makes any real cross-package import fail with `TS6059` the
  moment it's written. Caught by a throwaway smoke-import test during scaffolding, not by the
  empty-skeleton build.
