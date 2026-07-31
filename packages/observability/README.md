# @app/observability

Structured logging, Sentry setup, and request correlation for the web app and
background worker.

## Logging

Use the shared `logger` for normal application logs, or `createLogger()` when a
separate logger instance is needed (for example, in a test). Log records are
JSON and include `requestId` whenever they are emitted inside a request context.

```ts
import { logger, newRequestId, withRequestContext } from "@app/observability";

await withRequestContext(newRequestId(), async () => {
  logger.info({ jobId: "job_123" }, "starting notification job");
});
```

Pino replaces values with `[Redacted]` for these paths: `email`, `phone`,
`name`, `firstName`, `lastName`, `token`, `accessToken`, `refreshToken`,
`idToken`, `authorization`, `headers.authorization`, `headers.cookie`, the
equivalent fields under `auth`, fields on `user`, `child.name`, and the same
common PII keys one level beneath a logged object. Do not put sensitive data in
log messages: redaction only applies to structured fields.

## Request ID contract

Create one ID at the inbound boundary with `newRequestId()` and run all request
or job work through `withRequestContext(requestId, operation)`. Call
`getRequestId()` only inside that operation or work it starts. Node's
`AsyncLocalStorage` carries the ID through promises and timers; once the
operation finishes, there is no active request ID. The logger adds it to every
record, and Sentry adds it to the event's `requestId` tag.

## Sentry

Call `initWebSentry()` in the web runtime and `initWorkerSentry()` at worker
startup. Both helpers scrub PII from every event before it leaves the process
and add the active request ID tag. They read `sentry.{dsn, environment, release,
tracesSampleRate, profilesSampleRate}` from `@app/config`, or the corresponding
`env.SENTRY_*` values. Explicit helper options take precedence. Invalid or absent
sample rates default to `0`; valid rates must be between `0` and `1`.
