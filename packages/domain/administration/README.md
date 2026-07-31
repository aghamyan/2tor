# Administration domain

The staff-facing operations surface: user approval, tutor verification review, disputes (abuse
reports), content moderation, support tickets, tutor suspensions, discounts, data exports,
mass-deletion jobs, privacy-request fulfillment, role elevation, and security-setting changes —
plus the admin audit-log read screen. Implements spec §16.4.

## Files

| File                  | Responsibility                                                                                                                                                                   |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `models.ts`           | `AdministrationActor`, `AuditPort` (structural port onto `@app/audit`), `AdministrationDatabase`, and every record shape.                                                        |
| `errors.ts`           | `AdministrationError`.                                                                                                                                                           |
| `schemas.ts`          | Zod input schemas for every service function.                                                                                                                                    |
| `retention.ts`        | `classifyRetention` (legal vs. optional entity types) + `runDeletionJob` — pure, no I/O.                                                                                         |
| `services.ts`         | All business logic. Takes `AdministrationDatabase`/`AuditPort`/`AdministrationActor` as parameters — never imports `@app/db`, `@app/auth`, or `@app/audit` directly (see below). |
| `drizzle-database.ts` | Real `AdministrationDatabase`, backed by `@app/db`.                                                                                                                              |
| `runtime.ts`          | Composition root: session lookup (`@app/auth`) + the real `AuditPort` (`@app/audit`) + `createDrizzleAdministrationDatabase`.                                                    |
| `nav.ts`              | Auto-discovered nav entry (`apps/web/lib/nav-registry.ts`), visible to `administrator`/`super_administrator` only.                                                               |

## Why `services.ts` doesn't import `@app/auth` or `@app/audit`

Same reasoning as `packages/domain/consent/README.md`'s "Notification wiring" and
`packages/domain/matching/models.ts`'s `MatchingRole`: `packages/domain/package.json` (shared by
every domain module, out of this module's file scope to edit) declares `@app/db` but not
`@app/auth` or `@app/audit`. Under this workspace's strict pnpm linking, a bare `import ... from
"@app/audit"` placed inside `packages/domain/**` fails to resolve when the importing file is
loaded directly (e.g. by Vitest, which is exactly how `apps/web/tests/admin` exercises
`services.ts`). `models.ts` instead declares `AdministrationRole` and `AuditPort` as local,
structural types; `runtime.ts` is the one file that imports the real `@app/auth`/`@app/audit`
packages and bridges them into these shapes — it's only ever reached by the real Next.js app
(Turbopack resolves `@app/audit` via `tsconfig.base.json`'s path alias across the whole module
graph regardless of which package a file lives in), never by a test importing `services.ts`
directly.

## Two-person approval, end to end (bulk export)

The clearest worked example of `@app/audit`'s approval flow (full mechanism documented in
`packages/audit/README.md`) is `requestBulkExport` / `decideBulkExport`:

1. **Request** (admin A): `requestBulkExport` creates an `exports` row
   (`status: "pending"`, `requested_by_user_id: A`) and calls `audit.requestApproval({ action:
"bulk_export", resourceType: "exports", resourceId: export.id, ... })`, returning
   `{ export, approvalRequestId }`.
2. **Decide** (admin B, must differ from A): `decideBulkExport` checks, in order:
   - the export is still `"pending"`,
   - **`exportRecord.requestedByUserId !== actor.userId`** — a defense-in-depth check against the
     schema-native `requested_by_user_id` column, independent of the audit trail,
   - a fresh step-up MFA verification (`requireStepUpFresh`),
   - then calls `audit.approveHighRiskAction(...)`, which independently re-derives and enforces
     the same requester-vs-approver identity check by reading back the original
     `approval.requested` audit event — **this is the guarantee's actual source of truth**; the
     `exports` column check above is belt-and-suspenders, not a substitute for it.
     On approval, sets `exports.status = "processing"` and `approved_by_user_id = B`; a worker job
     (`apps/worker/src/jobs/admin/export-generation.job.ts`) later materializes the file.

`requestRoleElevation`/`decideRoleElevation` and `requestMassDeletion`/`decideMassDeletion` /
`requestSecuritySettingChange`/`decideSecuritySettingChange` follow the identical
request→approve/reject shape for the other high-risk kinds spec §16.4 lists. Mass deletion in
particular creates its `deletion_jobs` row **already `"blocked"`** (`blockReason:
"pending_approval"`); `decideMassDeletion` is the only thing that can flip it to `"scheduled"`,
which is what makes it eligible for the retention worker. Rejecting leaves it `"blocked"` with
`blockReason: "rejected"` — a deletion job that was voted down never quietly becomes eligible
later.

## Retention: legal records vs. optional content (`retention.ts`)

`runDeletionJob(job, executor, now)` is pure: it classifies `job.targetEntityType` via
`classifyRetention` into `"legal"` (compliance/financial/safety records —
`LEGAL_RETENTION_ENTITY_TYPES`: consent records, payment/invoice/payout rows, tutor verification
and background-check evidence, audit/access/login logs — never auto-deleted, matching
`packages/domain/consent/README.md`'s "Retention" section), `"optional"` (educational content —
`OPTIONAL_CONTENT_ENTITY_TYPES`: bookmarks, resources, discussion posts, messages, matching notes,
etc. — deletable), or `"unknown"` (not yet classified — treated as `"legal"`-adjacent and blocked,
never guessed at). Only an `"optional"` classification ever invokes `executor.deleteEntity(...)`;
`"legal"` and `"unknown"` both return `{ status: "blocked", blockReason }` without touching the
executor at all — a legal record cannot be erased by this function no matter what the executor
implementation does, because it's never called. See `apps/web/tests/admin/retention.test.ts`.

`apps/worker/src/jobs/admin/retention-deletion.job.ts` runs this against every `deletion_jobs` row
with `status = "scheduled"` and `scheduledFor <= now`, ages the underlying storage object out
(where applicable) before the DB row, and writes the outcome back via `setDeletionJobStatus` +
`recordAudit`. "Backup aging" (spec: deletion ages files out of backups on a documented schedule)
is a **documentation/alerting** concern at this stage, not a backup system this task builds: see
`apps/worker/src/jobs/admin/backup-verification-alert.job.ts`, which raises an `incidents` row if
no successful backup-verification signal has been recorded within the documented window, and the
note in that file about where the real backup-retention schedule must eventually be enforced
(infrastructure-level, outside this module's file scope).

## Staff message/record access (`recordStaffAccess`)

Thin wrapper over `@app/audit`'s `recordAdminAccessReason` — writes both `admin_access_reasons`
and an audit event for one staff read of a protected record, matching `@app/auth`'s
`message.access_as_staff` action (which requires `resource.reasonProvided === true` before
`authorize()` even allows the read). The web layer calls `recordStaffAccess` before granting a
staff actor access to, e.g., a conversation's messages.

## What this module does _not_ do

- **No new database tables or columns.** Every feature here (including the two-person approval
  flow) is built on `audit_events`, `admin_access_reasons`, and the existing `users` /
  `tutor_verifications` / `tutor_documents` / `tutor_suspensions` / `abuse_reports` /
  `content_reports` / `support_tickets` / `exports` / `deletion_jobs` / `privacy_requests` /
  `discounts` / `system_settings` tables already in `packages/db` — this module's file scope
  cannot modify `packages/db`.
- **Large refund / payment-config change** (two of spec §16.4's seven high-risk kinds) are left as
  documented extension points, not implemented here: they belong to a finance domain module that
  doesn't exist yet (`packages/db/src/schema/finance.ts` has the tables; there is no
  `packages/domain/finance` yet, and this task's file scope is `packages/domain/administration`
  only). `@app/audit`'s `HIGH_RISK_ACTIONS` catalog already includes both action kinds so that
  future module can adopt the identical `requestApproval`/`approveHighRiskAction` flow with no
  changes to `@app/audit` itself.
