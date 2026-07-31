# Playwright cross-module E2E

This suite runs Chromium headlessly against the real Next.js app and the isolated PostgreSQL
service in `docker-compose.test.yml`. The Playwright web-server harness resets the named
`2tor-test` volume, applies migrations, loads the normal demo seed plus E2E-only records, provides
deterministic Redis-compatible sessions, and starts Next. It tears down only the test Compose
project and its test volume.

## Run

Prerequisites: Docker with Compose v2, Node/pnpm versions from the repository, and the Playwright
Chromium binary.

```sh
pnpm --filter web exec playwright install chromium
pnpm --filter web exec playwright test --config ../../playwright.config.ts
```

Useful focused runs:

```sh
pnpm --filter web exec playwright test --config ../../playwright.config.ts enrollment-and-learning.spec.ts
pnpm --filter web exec playwright test --config ../../playwright.config.ts --grep "deletion erases"
```

The suite is intentionally single-worker and has retries disabled: the journeys share the freshly
seeded database and exercise state transitions whose ordering is part of the contract. CI failures
retain traces, screenshots, and video under `apps/web/e2e/test-results`.

## Journeys and §22.4 launch gates

| Spec                                 | Covered cross-module journey                                                                                                                                                                                                                                                                          | §22.4 launch gate evidence                                                                                                                                                                   |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `enrollment-and-learning.spec.ts`    | Throttled browser consultation submission → parent-created inactive student → activation blocked before consent → versioned verifiable-consent evidence → activation → parent request → staff match → tutor acceptance → first lesson/attendance/completion → tutor feedback → parent-safe projection | Automated implementation evidence for “verifiable parental consent is implemented and reviewed” (review remains external); authorization evidence; core path supporting accessibility review |
| `scheduling.spec.ts`                 | Weekly lessons across the `America/Los_Angeles` DST boundary; historical booking zone; late parent cancellation, charge decision, and duplicate cancellation rejection                                                                                                                                | Scheduling/cancellation hardening that supports “no critical authorization vulnerability remains”                                                                                            |
| `payments-and-payouts.spec.ts`       | Non-billing actor denied payment authorization; signed Stripe authorization event replayed; finance-only monthly AMD payout batch → reconciliation → CSV → evidence-backed completion                                                                                                                 | “payment webhooks are idempotent”; finance authorization portion of “no critical authorization vulnerability remains”                                                                        |
| `communication-safety.spec.ts`       | Tutor+minor private channel rejected; monitored parent-inclusive channel succeeds; staff read denied without a reason, then reason and audit rows are proven                                                                                                                                          | “all child-adult communications follow policy”; “no critical authorization vulnerability remains”                                                                                            |
| `privacy-and-administration.spec.ts` | Bulk export request → self-approval rejection → second-admin approval; two deletion requests → second-admin production-service approval → real retention worker → optional student interest erased while payment transaction remains legally retained                                                 | Privacy/data-deletion hardening; two-person authorization evidence for “no critical authorization vulnerability remains”                                                                     |

The tests do not claim to satisfy gates that require external review or operational history:
privacy/Terms legal review, tutor code of conduct, safeguarding training, backup-restore evidence,
mandatory production admin MFA configuration, tutor verification claim review, accessibility
sign-off, incident drills, or a full private-beta month.

## Test-only infrastructure

- `scripts/run-test-stack.mjs` is the Playwright-owned lifecycle process. It always uses
  `docker-compose.test.yml`; it never starts or resets the development Compose project.
- The small RESP session server implements only what the app's `getSession()` path reads. It
  avoids adding Redis to the database-only test Compose file and never bypasses route/domain
  authorization: each API still resolves a normal actor and performs its production checks.
- The disposable Next workspace injects an E2E consent notifier. It uses the production
  dispatcher/template/channel policy with a no-external-side-effect queue, so consent routes can
  complete without sending real email, push, or inbox jobs.
- `scripts/seed-e2e.sql` contains no production data. It adds a second administrator, a removable
  optional interest, and a pending Stripe authorization fixture.
- The webhook test signs the exact raw request body with an E2E-only secret; the route still uses
  the production Stripe signature verifier and database idempotency claim.
- The deletion test invokes the production two-person approval service and retention job
  definition with their real Postgres-backed audit/deletion adapters, then proves both the erased
  row and the retained legal row in PostgreSQL.
