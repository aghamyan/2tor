# Consent domain

Child-data notice and verifiable parental consent (spec §11.1). Owns `consent_records` and the
gate on `student_profiles.status` — the only path a covered-feature activation can take.

## ⚠️ Legal review required before launch

`consent-method.ts`'s `signedAttestationConsentMethod` (the only method registered in
`defaultConsentMethodRegistry`) is a **placeholder**, not a decision. It requires a parent to type
their full legal name and a fixed attestation phrase verbatim — enough to exercise this module's
plumbing and to prove, in code, that ticking a Terms-of-Service checkbox is not the same thing as
completing this flow. It is **not** a vetted COPPA §312.5(b) "reasonable effort" verification
method for monetized covered features. Before real users depend on this:

1. Legal counsel selects the production method(s) — candidates already modeled in
   `consentMethodEnum` (`packages/db/src/schema/families.ts`): a signed paper/PDF form returned
   via mail/fax/upload, a nominal credit-card charge, a live video-call check, government-ID
   verification, or a knowledge-based-authentication vendor.
2. Implement it against the `ConsentMethod` interface (`consent-method.ts`) and register it in
   `defaultConsentMethodRegistry` under the matching `ConsentMethodKey` (or pass a custom
   `ConsentMethodRegistry` into `recordConsent` at the composition root).
3. Nothing else in this module changes — `services.ts` only ever calls `ConsentMethod.verify()`
   through the registry, never a concrete implementation.

## Flow (D1 → D2 hand-off)

1. **D1 (`packages/domain/families`)**: parent creates the family, creates an inactive student
   profile, and the parent↔student link (`createStudentUnderParent`). Consent is not touched here.
2. Parent verifies email + phone (`users.emailVerifiedAt` / `phoneVerifiedAt` — owned by
   identity/auth, outside this module; `recordConsent` reads and requires both before proceeding).
3. Parent is presented the direct child-data notice (`CURRENT_CONSENT_VERSION` +
   `CURRENT_CONSENT_DATA_CATEGORIES` in `schemas.ts`) and explicitly acknowledges it
   (`noticeAcknowledged: true` — required, but alone still insufficient; see below).
4. Parent completes a `ConsentMethod` (see above). Only on `verified: true` does `recordConsent`
   write a `consent_records` row (version, timestamp, method, data categories, identity-evidence
   reference) and an audit event, in one transaction.
5. `activateStudent(studentId)` is the **only** function that flips `student_profiles.status` to
   `"active"`. It requires, in order: actor is the linked parent or staff; D1's
   `familyReadyForActivation` says the family is structurally ready; and — unless the student is
   an adult learner, who needs no parental consent — `hasValidConsent(studentId)` is true.

**Accepting Terms of Service alone never reaches step 4 or 5.** There is no code path from a
Terms/ToS flag to a `consent_records` row or to `activateStudent` succeeding — the only way to
create a row is through `recordConsent`, and the only way to activate is through `activateStudent`,
which independently re-checks `hasValidConsent` regardless of what else is true about the account.

## Cross-module reads

This module imports two read-only exports from `packages/domain/families` — `services.ts`'s
`familyReadyForActivation` and `parentLinkedToStudent`, plus `drizzle-database.ts`'s
`createDrizzleFamilyDatabase` (used only in `runtime.ts` to build the `FamilyDatabase` handle
passed into service calls). This is the explicit hand-off families' own README documents ("D2
calls it and then applies consent rules") — families' files are read, never modified, by anything
in this module.

## `hasValidConsent(studentId)`

Exported for other modules to call **before** exposing covered child data or functionality, per
spec: "verifiable parental consent... required before collecting, using, or disclosing personal
information from a child." "Valid" means at least one `consent_records` row exists for the student
with `revokedAt IS NULL` — not merely that consent was granted at some point, and not just "the
most recent row happens to be non-revoked" (an earlier row can still be valid after some later,
unrelated row is revoked).

## Retention

Consent records are never auto-deleted. `ConsentDatabase` has no delete method for
`consent_records`, and no job in this module removes rows — they are compliance evidence and are
kept as long as needed to demonstrate it, independent of student/account deletion elsewhere.

## Notification wiring

`recordConsent`/`activateStudent` take a `ConsentNotifier` as an explicit parameter rather than
importing `@app/notifications` directly, purely as a **testability** choice, verified as follows:

- `packages/domain/package.json` does not declare `@app/notifications` (or `@app/auth`) as a
  dependency. Under this workspace's strict pnpm linking, that means a bare `import ... from
"@app/notifications"` placed inside `packages/domain/**` cannot be resolved by tools that walk
  real `node_modules` from the importing file's own location — confirmed directly: running this
  module's tests through Vitest (no tsconfig-paths plugin configured for it) throws `Cannot find
package '@app/notifications'`, and reproducing the same probe against
  `packages/domain/families/runtime.ts`'s pre-existing `@app/auth` import throws identically.
- The real `apps/web` Next.js build does **not** have this problem: `next build` compiles
  `packages/domain/consent/runtime.ts`'s `@app/auth` import successfully (verified — Turbopack
  applies `tsconfig.base.json`'s `paths` aliases across the whole module graph regardless of which
  package a file physically lives in, and `tsc --noEmit -p apps/web/tsconfig.json` likewise passes
  clean). So this is a Vitest-resolver-only gap, not an application-runtime one — editing any
  `package.json` to "fix" it is unnecessary as well as outside this module's file scope.

Since `services.ts` is exactly what this module's required tests must exercise directly, it takes
`notifier: ConsentNotifier` as a parameter instead of importing `@app/notifications`, so its tests
run under Vitest with zero dependency on that package. `ConsentNotifier` (`models.ts`) is declared
structurally compatible with `@app/notifications`'s real `NotifyInput`/`notify()`, so the
composition root — `apps/web`, which _does_ declare `@app/notifications` — passes the real
`notify` function straight through with no adapter:

```ts
import { notify } from "@app/notifications/dispatch";
import { recordConsent } from "../../../../../packages/domain/consent/services";

await recordConsent(consentDatabase, familyDatabase, { notify }, actor, input);
```

`apps/web`'s consent action/route files import `notify` from `@app/notifications/dispatch`
specifically, not the `@app/notifications` barrel (`index.ts`). That barrel re-exports `./push`,
which has a pre-existing type error (`packages/notifications/src/push.ts`, outside this module's
file scope, unrelated to consent) that otherwise fails `next build`'s type-check pass the moment
anything in `apps/web` pulls the barrel in — confirmed by hitting it, then confirming it disappears
once the import is narrowed to `./dispatch` (which only imports `./templates`, never `./push`).

The real `notify()` still throws unless some composition root has called
`@app/notifications`'s `configureNotifications(...)` first — that remains `apps/web`'s
responsibility, not this module's. Because the notifier call happens after the DB transaction
commits, a notification failure cannot unwind an already-written consent record or activation —
the write stands even if the caller sees an error surfaced from the failed `notify()` call. Tests
in `apps/web/tests/consent` pass a trivial in-memory fake satisfying `ConsentNotifier` and never
need to import `@app/notifications` at all.

## Testing

`apps/web/tests/consent` covers this module with an in-memory `ConsentDatabase` +
`FamilyDatabase` pair (no real Postgres), following the same pattern as
`apps/web/tests/families/support/in-memory-family-database.ts`.
