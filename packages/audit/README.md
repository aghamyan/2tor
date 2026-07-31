# `@app/audit`

The append-only audit trail and the high-risk two-person approval flow every Phase-2 module
depends on. Implements spec §12.5 ("audit logs are append-only to application users"), §4.5
("staff message access requires a logged reason"), and §16.4 ("high-risk actions require step-up
authentication AND second-person approval").

## Modules

| File                 | Responsibility                                                                                                       |
| -------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `types.ts`           | `AuditStore` — the append-only port. No update/delete method exists anywhere on it.                                  |
| `in-memory-store.ts` | Pure in-process `AuditStore` for tests — no Postgres required.                                                       |
| `drizzle-store.ts`   | Real `AuditStore` backed by `audit_events`/`admin_access_reasons` via `@app/db`.                                     |
| `record-audit.ts`    | `recordAudit(store, values)` — the one way to append an `audit_events` row.                                          |
| `admin-access.ts`    | `recordAdminAccessReason(store, values)` — writes `admin_access_reasons` + an audit row together.                    |
| `query.ts`           | `queryAuditEvents(store, filters)` — cursor-paginated read API for admin audit-log screens.                          |
| `approval.ts`        | `requestApproval` / `approveHighRiskAction` — the two-person high-risk approval flow.                                |
| `errors.ts`          | `AuditError` (codes: `INVALID_INPUT`, `APPROVAL_NOT_FOUND`, `SELF_APPROVAL_FORBIDDEN`, `APPROVAL_ALREADY_RESOLVED`). |
| `index.ts`           | Barrel — re-exports everything above.                                                                                |

## `recordAudit(store, values)`

```ts
import { recordAudit, createDrizzleAuditStore } from "@app/audit";

const store = createDrizzleAuditStore(db); // db: @app/db's Database
await recordAudit(store, {
  actorUserId: actor.userId, // or `null` for a system/automated event
  action: "user.suspended",
  resourceType: "users",
  resourceId: targetUserId,
  reason: "Repeated policy violations.",
  previousValue: { status: "active" },
  newValue: { status: "suspended" },
});
```

Mints the row's id, validates the input (Zod), and inserts via `AuditStore.insertEvent` — the
**only** write path this package exposes. There is deliberately no `updateEvent`/`deleteEvent` on
`AuditStore`, in `drizzle-store.ts`, or anywhere else in this package: the guarantee is that
nothing in this package's API surface _can_ mutate or remove a row, not that nothing currently
does. `record-audit.test.ts`'s "exposes no way to update or delete" test asserts this against the
constructed store object directly (not just the compile-time type), so a future edit that quietly
adds a mutating method fails it.

That's still only half the guarantee — a caller could bypass this package and issue raw SQL.
`packages/db/migrations/0001_audit_events_immutable.sql` closes that gap with a
`BEFORE UPDATE OR DELETE` trigger directly on `audit_events`, which rejects both operations
unconditionally regardless of DB role. `immutability.integration.test.ts` proves this against a
real Postgres (skips cleanly if `DATABASE_URL_TEST` isn't reachable — see that file's docstring).

## `recordAdminAccessReason(store, values)`

Spec §4.5: staff reading a protected record for an operational/safety reason must write both an
`admin_access_reasons` row (the reason, tied to the specific target) and an audit event — not one
without the other. This function does both in one `AuditStore.transaction`:

```ts
await recordAdminAccessReason(store, {
  adminUserId: actor.userId,
  targetEntityType: "conversations",
  targetEntityId: conversationId,
  reason: "Investigating a safety report.",
  action: "staff.message_access", // optional; defaults to "staff.record_access"
});
```

## `queryAuditEvents(store, filters)`

Cursor-based per `docs/CONVENTIONS.md` ("Pagination on every list endpoint"). `filters.cursor` is
opaque — pass back a previous page's `nextCursor` verbatim; `nextCursor: null` means the last page
was reached. Filterable by `actorUserId` / `action` / `resourceType` / `resourceId` / `from` / `to`.
Default page size 50, capped at 200.

## The two-person high-risk approval flow

Spec §16.4 lists seven high-risk action kinds (`HIGH_RISK_ACTIONS` in `schemas.ts`): bulk export,
role elevation, audit access, mass deletion, large refund, payment-config change, and disabling a
security control. Each requires **both** step-up MFA and a _different_ person's approval — "a
super-admin cannot solely approve their own high-risk action."

**Why this isn't `@app/auth`'s job.** `authorize()`'s `cannot_self_approve` rule only blocks acting
on a resource whose _target_ is the actor themselves (e.g. approving your own user account). It
has no concept of "someone else already asked for this" — `authorize()` is stateless and sees one
call at a time, with no memory of who requested what. The requester-vs-approver identity check
needs to compare _two different actions across time_, which is exactly what this module tracks by
reading back the original request's `audit_events` row.

**Why this needs no new database table.** The flow is built entirely on `audit_events` — already
required to exist and already append-only:

1. **Request** (actor A, e.g. `admin-a`): `requestApproval(store, { actorUserId, action,
resourceType, resourceId, reason, payload })` writes one event
   (`action: "approval.requested"`, `resourceType: "approval_request"`) whose **event id becomes
   the `approvalRequestId`** returned to the caller. `payload` is free-form JSON — whatever the
   target mutation needs to actually run once approved (e.g. `{ roleKey: "finance", userId }`).
2. **Decide** (actor B, e.g. `admin-b`, must differ from A): `approveHighRiskAction(store, {
approvalRequestId, approverUserId, decision, reason })`:
   - loads the request event; `APPROVAL_NOT_FOUND` if it doesn't exist or isn't a request,
   - **`SELF_APPROVAL_FORBIDDEN` if `approverUserId === request.actorUserId`** — unconditional, no
     role or flag bypasses it (see `approval.test.ts`, "rejects self-approval... even when the
     same actor is the only super-administrator"),
   - `APPROVAL_ALREADY_RESOLVED` if a decision event already exists for this request,
   - otherwise writes a second event (`action: "approval.decided"`, `resourceType:
"approval_request"`, `resourceId: approvalRequestId`) and returns the decision, including the
     original `action`/`targetResourceType`/`targetResourceId`/`payload` read back off the request.

Approving/rejecting is **recorded**, never edited in place — "approved" and "requested" are two
rows, not one row with a mutated status column. Both steps are ordinary, immutable
`recordAudit`-shaped events, so the whole flow inherits the append-only guarantee above for free.

**What the caller still must do** (this module only tracks the two-person identity check and
records the decision):

1. Before `requestApproval`: `authorize()` the actor for the underlying action as usual.
2. Before `approveHighRiskAction`: `authorize()` the approver for the same action (so a role that
   isn't permitted to decide it can't, even if they're a different person than the requester), and
   check `isMfaFreshEnough` for step-up — this module has no notion of roles or MFA.
3. After a `decision: "approved"` result: actually perform the mutation, using
   `targetResourceType`/`targetResourceId`/`payload` off the returned `ApprovalDecisionRecord`.
   `approveHighRiskAction` never touches any table other than `audit_events` itself — it decides,
   it doesn't execute.

See `packages/domain/administration`'s bulk-export flow (`services.ts`'s `requestBulkExport` /
`decideBulkExport`) for a complete worked example wiring all three steps together, including how
it also updates `exports.approved_by_user_id` alongside the audit trail once approved.

## Testing

`in-memory-store.ts` is a pure, dependency-free `AuditStore` — the same port `drizzle-store.ts`
implements, just backed by an array instead of Postgres. This matters for what the tests actually
prove: `approval.test.ts`'s self-approval tests exercise the **real** `approveHighRiskAction`
decision logic (the exact code path `drizzle-store.ts` runs in production), with only the storage
swapped out — not a hand-rolled fake of the whole approval flow that could silently drift from
what production does. `immutability.integration.test.ts` is the one exception: it talks to a real
Postgres directly (raw SQL, bypassing `AuditStore` on purpose) to prove the DB trigger itself
rejects UPDATE/DELETE, and skips cleanly if `DATABASE_URL_TEST` isn't reachable.

## Wiring note for consumers

`packages/domain/<module>/package.json` doesn't exist per-module — every domain module shares
`packages/domain/package.json`, which does not (and, per this task's file scope, could not) list
`@app/audit` as a dependency. Follow the same composition pattern `packages/domain/consent` uses
for `@app/notifications`/`@app/auth`: declare a small structural port in your module's `models.ts`
(e.g. `AuditPort` in `packages/domain/administration/models.ts`) shaped like the functions you
actually call, take it as an explicit parameter in `services.ts`, and only import the real
`@app/audit` package in `runtime.ts`/`drizzle-database.ts` (the composition-root files Next.js/
Turbopack resolves via `tsconfig.base.json`'s path aliases, never exercised directly by Vitest).
This keeps `services.ts` unit-testable with an in-memory fake and zero dependency on `@app/audit`
actually resolving under a bare `vitest run` from inside `packages/domain`.
