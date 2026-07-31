# worker

BullMQ job consumer. Domain modules add jobs by dropping a `*.job.ts` file under
`apps/worker/src/jobs/<module>/` — nothing in this app needs to be edited to register a new job.

## The `*.job.ts` contract

A job file exports its job definition, either as `default` or as one or more named exports (useful
when one file registers several related jobs). Use the `defineJob` helper from `./job` for type
inference — it performs no validation itself, the registry does that at discovery time.

```ts
// apps/worker/src/jobs/billing/send-receipt.job.ts
import { defineJob } from "../../job";

const schema = {
  parse: (input: unknown) => {
    /* throw on invalid input, else return it typed */
  },
  safeParse: (input: unknown) => {
    /* { success: true, data } | { success: false, error } */
  },
};

export default defineJob({
  name: "billing.send-receipt", // globally unique across the whole registry
  queue: "billing",
  schema,
  async handler(data, ctx) {
    ctx.log.info({ invoiceId: data.invoiceId }, "sending receipt");
    // ...
  },
  options: {
    attempts: 5,
    backoff: { type: "exponential", delay: 2000 },
  },
});
```

Required fields:

- **`name`** — unique across every discovered job. Used as the BullMQ job name and as the
  namespace for dead-letter and idempotency keys. Discovery throws at startup if two files export
  the same name.
- **`queue`** — BullMQ queue name. Jobs sharing a queue are processed by one `Worker`, dispatched
  by `name`, so related jobs can share a queue or each get their own.
- **`schema`** — anything with Zod's `parse`/`safeParse` shape. **A real `z.object({...})` schema
  satisfies this with no adapter** — `job.ts` only declares the minimal structural interface it
  needs (see "Known limitations" below for why it doesn't import `zod` itself). Payloads are
  `safeParse`d before the handler runs; a validation failure is treated as **non-retryable** (it
  throws BullMQ's `UnrecoverableError`, so a malformed payload doesn't burn through retry attempts
  before landing in the dead-letter queue).
- **`handler`** — `(data, ctx) => Promise<void>`. `ctx` is `{ jobId, queue, name, attemptsMade, log }`.

Optional `options`:

| Field                   | Default                                | Meaning                                                                                                                  |
| ----------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `attempts`              | `3`                                    | Max attempts before a job is terminally failed.                                                                          |
| `backoff`               | `{ type: "exponential", delay: 1000 }` | BullMQ `BackoffOptions` between attempts.                                                                                |
| `idempotent`            | `false`                                | See "Idempotency" below.                                                                                                 |
| `idempotencyKey`        | —                                      | `(data) => string`. **Required** when `idempotent: true`.                                                                |
| `idempotencyTtlSeconds` | 7 days                                 | How long a completed idempotency key is remembered.                                                                      |
| `repeat`                | —                                      | BullMQ `RepeatOptions` (typically `{ pattern: "<cron>" }`). Presence makes this a scheduled job — see "Schedules" below. |
| `repeatPayload`         | `{}`                                   | Payload passed to the handler on each repeat tick. Must satisfy `schema`.                                                |

## How discovery works (`registry.ts`)

`discoverJobs()` globs `apps/worker/src/jobs/**/*.job.ts` (native `fs.promises.glob` — no new
dependency needed) and dynamically `import()`s every match. For each file it collects every export
that structurally looks like a job definition (`name`/`queue`/`schema`/`handler` present). It
throws at startup, not silently, when:

- a `*.job.ts` file exports nothing job-shaped (very likely a typo, not an empty job file), or
- two files export the same job `name`.

`index.ts` calls `discoverJobs()` with no arguments (its default root); tests pass `{ root }` to
point it at fixtures instead. Dropping a new file under `src/jobs/<module>/` is all a domain module
needs to do — the next worker boot picks it up automatically.

## Retries, backoff, and the dead-letter queue (`queue.ts`)

BullMQ has no built-in dead-letter queue, so this app implements one: each queue `<name>` gets a
companion `<name>-dlq` queue (`:` isn't a legal character in a BullMQ queue name, hence `-dlq` not
`:dlq`). A job's `failed` event fires on **every** failed attempt, including ones BullMQ is about
to retry — the terminal signal is `job.finishedOn`, which BullMQ only sets once it has decided not
to retry (attempts exhausted, or the handler threw `UnrecoverableError`). Only then is the job
copied into the dead-letter queue, as:

```jsonc
{
  "originalJobId": "...",
  "originalQueue": "...",
  "data": {/* the original job payload */},
  "failedReason": "...",
  "attemptsMade": 3,
  "failedAt": "2026-01-01T00:00:00.000Z",
}
```

The original job is left in the source queue's `failed` set (for BullMQ-native introspection);
the DLQ entry is what an admin/replay tool should read from.

## Idempotency

Set `options.idempotent: true` and provide `options.idempotencyKey: (data) => string` on any
high-risk job (payments, side-effecting external calls, anything where "ran twice" is a real
incident, not a formatting glitch). Before running the handler, the worker checks a Redis key
(`worker:idempotency:<queue>:<name>:<key>`); if it's already set (a prior run **completed
successfully**), the handler is skipped and the job is reported completed as a no-op. The key is
only set **after** the handler succeeds — a failed attempt does _not_ set it, so BullMQ's normal
retry behavior still applies to a job that hasn't yet succeeded.

This is deliberately a simple "remember successes" cache, not a distributed lock: two jobs racing
with the same key _at the same instant_ could both start the handler before either finishes. If a
job needs true mutual exclusion (not just "don't double-apply a completed effect"), add that inside
the handler itself (e.g. a DB-level unique constraint or advisory lock).

## Schedules / repeatable (cron) jobs (`schedule.ts`)

A job with `options.repeat` set (e.g. retention deletion, missed-feedback reminders,
backup-verification alerts, analytics aggregation, payout report generation) is discovered exactly
the same way as an on-demand job — the only difference is that presence. `index.ts` calls
`registerSchedules(discovered)` once at startup, which upserts each into BullMQ as a repeatable
producer. This is safe to call on every boot: BullMQ upserts a repeatable job by `name` + repeat
key (`override: true` under the hood), so an unchanged schedule is a no-op on restart and a changed
`pattern` replaces the old schedule instead of running both side by side.

## Admin visibility: `getQueueStats`

```ts
import { getQueueStats } from "./queue"; // also re-exported from ./index

const stats = await getQueueStats(["billing", "notifications"]);
// [{ queue: "billing", counts: { waiting, active, completed, failed, delayed, paused },
//    deadLetter: { queue: "billing-dlq", counts: { ...same shape } } }, ...]
```

Pure function over a Redis connection and a list of queue names (`Queue#getJobCounts` under the
hood) — exported for Administration (D17) to call. Apps in this repo don't import from other apps,
so wiring this into an actual admin surface (HTTP route, RPC, etc.) is D17's concern; this function
intentionally stops at "here are the numbers."

## Configuration

`REDIS_URL` is read directly from `process.env` (see `getConnection()` in `queue.ts`) — `index.ts`
calls `process.loadEnvFile()` against the repo-root `.env` on startup (falling back to whatever the
environment already provides, e.g. `docker-compose.yml`'s `env_file: .env` for the containerized
worker). This bypasses `@app/config` deliberately: that package's server env module
(`packages/config/src/env.ts`) is not reachable from outside `@app/config` itself — its
`package.json` only declares an `"exports": { ".": "./src/index.ts" }` subpath, and `index.ts`
re-exports only the browser-safe `publicEnv`. Once `@app/config` exposes a server-safe entrypoint
usable from a plain Node runtime, `queue.ts`'s `getRedisUrl()` should switch to it instead.

## Known limitations (not fixable from `apps/worker/**`)

- **`@app/observability`'s logger can't be imported from `apps/worker` at runtime.**
  `packages/observability/src/sentry.ts` does `import * as appConfig from "@app/config"`, but
  `@app/config` isn't declared in `packages/observability/package.json`'s dependencies. Under
  pnpm's strict linking that import is unresolvable from anywhere outside `packages/observability`
  itself — confirmed with both a plain Node `require.resolve` and a real `vitest run`, so it's not
  a test-runner quirk, it also blocks `tsx src/index.ts` in production. `job.ts` therefore declares
  its own minimal `JobLogger` interface (not `typeof` the pino `Logger`), and `queue.ts` provides a
  structured-JSON `console.log`/`console.error` implementation of it. The fix is a one-line
  dependency addition to `packages/observability/package.json`; once that lands, swapping
  `queue.ts`'s `logger` for `@app/observability`'s is a one-import change, not a type change (every
  call site already uses the same `log.info(bindings, message)` shape pino uses).
- **`zod` isn't a dependency of `apps/worker`.** `job.ts`'s `JobSchema<T>` interface is
  structurally, not nominally, compatible with `zod` (`parse`/`safeParse`) so a real `z.object()`
  schema satisfies it directly — but a `*.job.ts` file that wants to build one still needs `zod`
  resolvable from wherever it's authored (e.g. via its own module's dependencies, or once
  `@app/validation` re-exports it) — that's outside this app's `package.json`, which this ticket
  cannot edit.

## Running the tests

`registry.test.ts` (glob discovery, duplicate/invalid-export detection) needs no external
services. `queue.test.ts` and `schedule.test.ts` run against a real Redis — no BullMQ behavior here
(retry timing, backoff, the dead-letter path) is meaningfully mockable, and this repo's convention
is real datastores in tests, never mocks. They self-skip (rather than fail) if Redis isn't reachable:

```bash
docker compose up -d redis   # from the repo root
pnpm --filter worker test
```
