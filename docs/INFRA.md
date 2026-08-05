# Local & Staging Infrastructure

Docker Compose setup for Postgres, Redis, MinIO (S3-compatible storage), and Caddy
(reverse proxy / TLS termination), plus an isolated compose file for the test database.

## Services

| Service      | Image                                            | Purpose                                               | Reachable from host?                                                     |
| ------------ | ------------------------------------------------ | ----------------------------------------------------- | ------------------------------------------------------------------------ |
| `postgres`   | `postgres:16-alpine`                             | Primary application database                          | `127.0.0.1:$POSTGRES_PORT` only                                          |
| `redis`      | `redis:7-alpine`                                 | BullMQ queue backend / cache                          | `127.0.0.1:$REDIS_PORT` only                                             |
| `minio`      | `minio/minio:RELEASE.2024-10-13T13-34-11Z`       | S3-compatible object storage                          | `127.0.0.1:$MINIO_PORT` (API), `127.0.0.1:$MINIO_CONSOLE_PORT` (console) |
| `minio-init` | `minio/mc:latest`                                | One-shot job: creates the app bucket, sets it private | n/a (exits after running)                                                |
| `caddy`      | `caddy:2-alpine`                                 | Reverse proxy, TLS termination                        | **Public** — `$HTTP_PORT`/`$HTTPS_PORT`, all interfaces                  |
| `web`        | built from `docker/web.Dockerfile`               | Next.js app                                           | Not published — only Caddy reaches it                                    |
| `worker`     | built from `docker/worker.Dockerfile`            | BullMQ job consumer                                   | Not published                                                            |
| `db_test`    | `postgres:16-alpine` (`docker-compose.test.yml`) | Isolated database for CI/integration tests            | `127.0.0.1:$POSTGRES_TEST_PORT` only                                     |

Only `caddy` binds to all interfaces. Every other service either isn't published at all
(`web`, `worker`, `minio-init`) or is bound to `127.0.0.1` explicitly — nothing but Caddy is
reachable from outside the host.

Two Docker networks enforce this at the network level too, not just via port bindings:
`edge` (caddy + web — the only path in from outside) and `data` (postgres, redis, minio,
minio-init, web, worker). Caddy is never attached to `data`, so it has no route to postgres,
redis, or minio even over the internal Docker network.

## Quickstart

```bash
cp .env.example .env        # edit values as needed; defaults work out of the box

# Infra only (postgres, redis, minio, caddy) — this is what `docker compose up` starts
docker compose up

# Full stack, including the Next.js app and worker (builds docker/web.Dockerfile and
# docker/worker.Dockerfile first)
docker compose --profile app up --build

# Isolated test database (separate volume/port, doesn't touch the dev stack above)
docker compose -f docker-compose.test.yml up
```

`web`/`worker` sit behind the `app` [Compose profile](https://docs.docker.com/compose/how-tos/profiles/)
deliberately: the infra services this task is scoped to (postgres/redis/minio/caddy) must
come up healthy on a bare `docker compose up` regardless of whether the application images
build successfully. Bring the app up explicitly with `--profile app` once you want it.

For local development, running `pnpm dev` on the host (Node 22+, see `.nvmrc`) against the
infra services from `docker compose up` is usually simpler than the containerized `web`/
`worker` services — see `docker-compose.override.example.yml` if you do want the app itself
running in a container with live-reload.

### First run: verifying health

```bash
docker compose up -d
docker compose ps        # all four should reach "healthy"
```

Postgres, Redis, and MinIO all expose `pg_isready` / `redis-cli ping` / `curl .../health/live`
healthchecks; Caddy's healthcheck hits its own internal `:2019/healthz` responder (see
`docker/Caddyfile`) rather than the `web` upstream, so Caddy reports healthy independently of
whether the `app` profile is running.

## Configuration (`.env`)

`.env.example` documents every variable the compose files read, grouped by service. A few
notes on how they're used:

- **`DATABASE_URL` / `REDIS_URL` in `.env`** are host-facing (`localhost`-based) — they're
  what you'd use running `pnpm --filter db db:migrate` or similar directly on the host against
  the Dockerized Postgres/Redis (ports are mapped to `127.0.0.1`). Inside `docker-compose.yml`,
  the `web`/`worker` services are given their own `DATABASE_URL`/`REDIS_URL`/`S3_*` values built
  from the same credentials but pointed at the internal service hostnames (`postgres`, `redis`,
  `minio`) instead — containers don't talk to each other through the host-mapped ports.
- **`S3_*` instead of `AWS_*`.** The app's S3 client config is read from `S3_ENDPOINT`,
  `S3_ACCESS_KEY_ID`, etc. rather than the AWS SDK's ambient `AWS_ACCESS_KEY_ID` / instance-role
  auto-detection, specifically so local/staging runs always use the explicit MinIO credentials
  you set here and never silently pick up unrelated AWS credentials from the environment.
- **The "Application integrations" section** (Resend, SES, web push, Sentry, Zoom, session/KMS
  secrets) are passed through to the `web`/`worker` containers via `env_file: .env` in
  `docker-compose.yml` — set real values in your untracked `.env`, never in `.env.example`.

## Migration path: RDS + managed Redis + real S3 (env swap, no code change)

The app talks to Postgres/Redis/S3 purely through `DATABASE_URL` / `REDIS_URL` / `S3_*` env
vars — nothing in the application depends on these services running in Docker specifically.
Moving to managed AWS services is a matter of pointing those same variables at the managed
endpoints; no application code changes:

| Variable                                    | Local/staging (this compose file)              | Production                                                                                                |
| ------------------------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                              | `postgres://...@postgres:5432/app` (container) | `postgres://<user>:<pass>@<rds-endpoint>.rds.amazonaws.com:5432/app?sslmode=require`                      |
| `REDIS_URL`                                 | `redis://:<password>@redis:6379` (container)   | `rediss://:<auth-token>@<cluster>.cache.amazonaws.com:6379` (ElastiCache, TLS enabled — note `rediss://`) |
| `S3_ENDPOINT`                               | `http://minio:9000`                            | unset (the AWS SDK defaults to the real regional S3 endpoint when no custom endpoint is configured)       |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | MinIO root credentials                         | A scoped IAM user/role's credentials — **not** account root, restricted to the app's bucket only          |
| `S3_FORCE_PATH_STYLE`                       | `true` (MinIO requires path-style requests)    | `false` (real S3 uses virtual-hosted–style by default)                                                    |
| `S3_BUCKET` / `S3_REGION`                   | `app-uploads` / `us-east-1` (arbitrary, local) | The real bucket name and its actual AWS region                                                            |

Steps when cutting over an environment:

1. Provision RDS (Postgres 16, matching the `postgres:16-alpine` version used locally),
   ElastiCache (Redis, TLS enabled), and an S3 bucket (private, versioning + a bucket policy
   scoped to one IAM role).
2. Set the table above's variables to the managed endpoints/credentials in that environment's
   secrets store — do not put real secrets in `.env.example` or any committed file.
3. Point `SITE_ADDRESS` at the real domain and remove `tls internal` from `docker/Caddyfile`
   (see below) so Caddy provisions a real Let's Encrypt certificate instead of its local CA —
   or terminate TLS at a load balancer in front of Caddy/the app entirely and drop Caddy from
   that environment if your infra already terminates TLS upstream.
4. Nothing under `apps/` or `packages/` changes — the swap is entirely in the environment
   configuration.

## Caddy / TLS

`docker/Caddyfile` defaults to `tls internal` — Caddy's own local CA — because `localhost`
(and most private/staging addresses) can't get a publicly-trusted certificate. For a real
public domain:

1. Set `SITE_ADDRESS` to the real domain and `CADDY_EMAIL` to an address Let's Encrypt can
   contact about certificate issues.
2. Delete the `tls internal` line in `docker/Caddyfile`. Caddy's automatic HTTPS then
   provisions and renews a real Let's Encrypt certificate for `SITE_ADDRESS` on its own —
   ports 80/443 need to be reachable from the internet for the ACME HTTP-01 challenge.

## Security/hardening notes

- Postgres, Redis, and MinIO run with `read_only: true` plus `tmpfs` mounts for the
  directories they need to write at runtime (`/tmp`, and Postgres's `/var/run/postgresql`
  socket directory) — their actual data only persists in the named volumes.
- `web` and `worker` run as a non-root user (uid `1001`) with `read_only: true`; `web` gets a
  `tmpfs` at `.next/cache` since Next.js writes there at runtime.
- The `minio-init` job explicitly sets the bucket's anonymous access policy to `none` — it's
  private by default, not just "not advertised."
- No secrets are committed. `.env` is gitignored (see root `.gitignore`); `.env.example`
  contains only placeholder values.

## Known build-time gotchas (already handled in `docker/*.Dockerfile`, documented here so a

future change doesn't accidentally reintroduce them)

- **Node 26 dropped bundled Corepack.** The base image installs it explicitly
  (`npm install -g corepack@latest`) before `corepack enable`.
- **`COREPACK_HOME` must be a world-readable path.** Corepack's default cache lives under
  `/root`, which the non-root runtime user can't read — set to `/opt/corepack` instead. Without
  this, `pnpm start` at container runtime falls back to downloading pnpm from the registry on
  every start, which fails wherever egress is restricted.
- **`turbo prune` doesn't follow `tsconfig.json`'s `extends`.** `tsconfig.base.json` is copied
  into the build explicitly from the pre-prune checkout; without it, every package's `tsc
--noEmit` build step fails with `TS5083: Cannot read file '.../tsconfig.base.json'`.
- **`apps/worker`'s "build" script (`tsc --noEmit`) is a type-check gate, not a compile step** —
  the worker runs straight from TypeScript source via `tsx` at runtime (no package in this repo
  emits a `dist/`), so `docker/worker.Dockerfile` skips `turbo run build` entirely.

## Verification status

Empirically verified while writing this, with real `docker build` / `docker compose up` /
`docker exec` against this repo (not just written from documentation):

- `docker compose up` — postgres, redis, minio, and caddy all reach `healthy`; `minio-init`
  creates `app-uploads` and confirms it's private; Postgres/Redis both answer real queries;
  Caddy serves TLS via `tls internal` and its `:2019/healthz` responder works independent of
  the `web` upstream.
- `docker compose -f docker-compose.test.yml up` — `db_test` reaches `healthy` on `127.0.0.1:5433`
  and accepts real connections, isolated from the main stack's volume/network.
- `docker build -f docker/web.Dockerfile .` and `docker build -f docker/worker.Dockerfile .`,
  plus running the resulting images (`web` served `HTTP 200` on `/`; `worker` ran `tsx
src/index.ts` cleanly) — both succeeded against the repo as it stood at the time.

**Not currently verified:** since that build, `packages/i18n` gained a `provider.tsx` with a
type error (JSX used without the package declaring `react`/a `jsx` compiler option) — this
looks like unrelated, in-progress work landing in this shared repo, and it's package source,
out of scope for this infra task to fix. Until it's fixed, `docker build -f
docker/web.Dockerfile .` (and therefore `docker compose --profile app up --build`) fails at the
`turbo run build --filter=web...` step — before `web`'s container, and its `read_only: true` +
non-root runtime, ever start. Once that type error is resolved, re-run `docker compose
--profile app up --build` to confirm the app profile end-to-end; the Dockerfile logic itself
isn't in question (it built clean moments before that change landed), only whether app source
currently compiles.
