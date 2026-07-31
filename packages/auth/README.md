# `@app/auth`

Authentication, sessions, MFA, password hashing, and the relationship-aware `authorize()`
authorization engine used by every protected operation in the platform. This package is the
canonical implementation of spec §4 (roles/permissions), §12.1–§12.2 (authentication/
authorization), and the "step-up authentication" requirement in §16.4.

## Why this package has no `@app/db`, `@app/config`, or Redis dependency

`packages/auth/package.json` lists only `argon2`, `ulid`, and `zod`. This isn't an oversight —
strict pnpm workspace isolation means `packages/auth/node_modules` only symlinks those three
(verified directly: nothing else resolves from inside this package). Concretely, that means:

- **No DB access.** `authorize()` never queries `tutor_student_assignments`,
  `parent_student_links`, etc. itself. The caller (a route handler / `packages/domain` service)
  reads the relevant row(s) and passes the **relationship facts** in as part of the `resource`
  argument — see below.
- **No Redis client.** The session store (`./session.ts`) is written against a small `RedisLike`
  interface, not `ioredis` directly. The consuming app (`apps/web`, which does depend on
  `ioredis`/`@app/config`) constructs the real client and passes it in. Any object satisfying the
  interface works — including the in-memory fake used in this package's own tests.
- **No secrets in this package.** Anything secret (session signing keys, KMS references) is read
  from `@app/config` by the caller and passed into this package's functions as parameters. This
  package itself never touches `process.env`.

This is a deliberate hexagonal/dependency-injection boundary, not a workaround: it's what makes
every rule in this package unit-testable without a database or a running Redis (see
`apps/web/tests/auth/`), and it keeps this package usable from any future context (a route
handler, a worker job, a CLI script) without dragging in unrelated infrastructure.

## Modules

| File                 | Responsibility                                                                                                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `internal/crypto.ts` | Shared primitives: SHA-256/HMAC hex digests, random tokens, constant-time compare. Not exported from the package barrel.                                                       |
| `password.ts`        | Argon2id hashing/verification, password strength policy, single-use expiring password reset tokens.                                                                            |
| `mfa.ts`             | TOTP (RFC 6238) generation/verification implemented directly against `node:crypto` (no otplib dependency), recovery codes, and the MFA-requirement gate used at login/step-up. |
| `rbac.ts`            | The role/action catalog, MFA-requirement matrix, session-lifetime matrix, and step-up action list — the single source of truth `authorize()` and `login()` both read from.     |
| `authorize.ts`       | The `authorize(actor, action, resource)` engine.                                                                                                                               |
| `session.ts`         | Redis-backed session store (via injected `RedisLike`), secure cookie construction, CSRF tokens, "log out all devices", new-device detection.                                   |
| `login.ts`           | Pure login decision: password check → account status → MFA gate. No I/O.                                                                                                       |
| `index.ts`           | Barrel — re-exports everything above except `internal/`.                                                                                                                       |

## Password hashing & reset

- `hashPassword` / `verifyPassword` use **argon2id** (OWASP baseline: 19 MiB memory, 2 iterations,
  parallelism 1). `verifyPassword` never throws — a malformed hash or wrong password both resolve
  to `false`.
- `validatePasswordStrength` enforces a 12-character minimum, at least 3 of 4 character classes
  (lower/upper/digit/symbol), and a small common-password denylist. Pure and synchronous — call it
  client-and-server-side before hashing.
- `issuePasswordResetToken` / `checkPasswordResetToken` implement single-use, expiring reset
  tokens: the raw token is emailed to the user and never stored; only its SHA-256 hash is
  persisted (in `password_reset_tokens.token_hash`). `checkPasswordResetToken` checks hash match →
  used → expired, in that order, and returns `{ valid: false, reason: "invalid" | "used" |
"expired" }`. **The caller is responsible for writing `usedAt` back to storage** after a
  successful reset — this package only validates, it doesn't persist.

## MFA (TOTP)

`generateTotpSecret` / `getTotpProvisioningUri` / `generateTotpCode` / `verifyTotpCode` implement
RFC 6238 TOTP (HMAC-SHA1, 30s step, 6 digits by default) directly against `node:crypto`, including
a hand-rolled base32 codec — there's no MFA library available inside this package's dependency
sandbox. Correctness is pinned in `apps/web/tests/auth/mfa.test.ts` against the **published RFC
6238 Appendix B test vector**, not just a generate→verify round trip (a round trip can pass even
if the base32 codec and the HOTP byte layout are both wrong in a matching way).

`verifyTotpCode` accepts a `window` (default 1) of adjacent 30-second periods to tolerate clock
drift. Recovery codes (`generateRecoveryCodes` / `hashRecoveryCode` / `verifyRecoveryCode`) are
single-use, human-formatted (`XXXXX-XXXXX`), and stored only as a SHA-256 hash.

`assertMfaSatisfied({ roles, mfaEnabled, mfaVerified })` is the **login-time** MFA gate — `login()`
in `login.ts` calls it with `mfaVerified` meaning "a valid TOTP/recovery code was presented in
this login attempt." It is driven by `MFA_REQUIREMENT` in `rbac.ts`:

| Role                  | MFA requirement                                                              |
| --------------------- | ---------------------------------------------------------------------------- |
| `parent`              | optional                                                                     |
| `student`             | optional (N/A — students authenticate via parent/admin-provisioned username) |
| `tutor`               | recommended (not enforced by `assertMfaSatisfied`)                           |
| `finance`             | **required**                                                                 |
| `administrator`       | **required**                                                                 |
| `super_administrator` | **required**                                                                 |

If _any_ role an actor holds requires MFA, the gate requires it — a `parent + finance` actor is
still gated. An actor with `mfaEnabled: false` gets `mfa_setup_required`; `mfaEnabled: true` but no
valid code this attempt gets `mfa_verification_required`.

**TOTP codes are not checked for replay by this package.** `verifyTotpCode` will accept the same
code twice within its ~30–90s validity window (`window` periods either side of "now"). The DB
schema has `mfa_methods.last_used_at` for exactly this — the caller must reject a code whose
derived counter isn't newer than the last one recorded for that method before accepting it. This
is deliberately left to the caller (this package has no persistence), not silently unhandled.

## Sessions & cookies

`createSession(redis, { userId, roles, mfaVerifiedAt, ipAddress?, userAgent? })`:

- Generates a ULID session id, stores a JSON `SessionRecord` in Redis at `session:{id}` with a
  `PX` TTL equal to the session's absolute lifetime, and adds the id to a `user_sessions:{userId}`
  Redis set (used for listing and "log out all devices").
- The lifetime is **the shortest `SESSION_LIFETIME_MINUTES` across every role the actor holds**
  (`resolveSessionLifetimeMinutes`), so an admin+parent user still gets the shorter admin
  lifetime:

  | Role                        | Lifetime |
  | --------------------------- | -------- |
  | `parent` / `student`        | 14 days  |
  | `tutor`                     | 7 days   |
  | `finance` / `administrator` | 2 hours  |
  | `super_administrator`       | 1 hour   |

  These are MVP defaults, not numbers from a compliance review — tune `SESSION_LIFETIME_MINUTES`
  before public launch if product/legal want different values.

- Returns a `SessionCookieOptions` descriptor (`httpOnly: true`, `secure: true`, `sameSite:
"lax"`, `path: "/"`, `maxAge` in seconds) shaped to drop directly into `cookies().set(name,
value, options)` in a Next.js route handler/server action — this package never touches
  `next/headers` itself, keeping it framework-agnostic.
- **Lifetime is absolute, not sliding.** `touchSession` updates `lastSeenAt` without resetting the
  TTL, so an admin session still expires 2 hours after login regardless of activity.

**`mfaVerifiedAt` is a timestamp, not a "step-up satisfied" flag.** `createSession` records it
once from login (`null` if MFA wasn't verified this login). Feed it straight into `authorize()`'s
`Actor.mfaVerifiedAt` — **do not** treat "MFA verified at login" as good for the life of the
session. `authorize()`'s `isMfaFreshEnough` only accepts a verification within
`STEP_UP_FRESHNESS_MINUTES` (15, by default) of the action's `now`. For a step-up-gated action
(see the permission matrix's **SU** cells) on a session older than that window, the caller must
re-prompt for a TOTP/recovery code, call `recordStepUpMfaVerification(redis, sessionId)` on
success, and only then re-read the session and call `authorize()`. This is deliberate: a session
created at login with MFA satisfied must not silently authorize a high-risk action hours later
with no re-challenge — see `apps/web/tests/auth/authorize.test.ts`'s "step-up freshness" suite.

`revokeSession` (single device), `revokeAllSessionsForUser` (spec §12.1 "log out all devices"),
and `listSessionsForUser` (a "manage devices" screen) round out the store. A DB `sessions` table
also exists (`packages/db/src/schema/identity.ts`) — that's for durable listing/audit history;
Redis here is the live, authoritative store that actually gates requests. A completed password
reset (`checkPasswordResetToken` returning `valid: true` and the new password being set) should be
followed by the caller invoking `revokeAllSessionsForUser` — an attacker with a hijacked session
should not stay logged in past a reset they didn't trigger.

**New-device detection** (`deviceFingerprint`, `isNewDevice`, `rememberDevice`) hashes
IP+user-agent into a fingerprint and tracks known fingerprints per user in a Redis set. This
package only detects; **the caller decides whether to alert** (spec §12.1 "new-device alerts for
staff") via `@app/notifications`, typically only for staff roles (tutor/finance/admin/super-admin).

**CSRF**: `generateCsrfToken` / `verifyCsrfToken` derive a token via HMAC-SHA256 from the
session's own `csrfSecret` (a synchronizer-token pattern) — verification needs no extra Redis call
since the caller already has the `SessionRecord` from `getSession`.

## `authorize(actor, action, resource, now?)`

```ts
import { authorize } from "@app/auth";

const result = authorize(
  {
    userId: tutorUserId,
    roles: ["tutor"],
    mfaVerifiedAt: session.mfaVerifiedAt ? new Date(session.mfaVerifiedAt) : null,
  },
  "academic.edit_learning_plan",
  { kind: "student", studentProfileId, tutorAssignment: assignmentRow },
);
if (!result.allowed) {
  // result.reason: e.g. "no_relationship", "step_up_required", "role_not_permitted"
  return forbidden(result.reason);
}
```

**Deny-by-default.** Every branch that can allow does so explicitly (`permitted = ...`); anything
not explicitly allowed — including an `action`/`resource.kind` unrecognized at runtime — falls
through to a final deny. A TypeScript exhaustiveness check (`const exhaustiveCheck: never =
action`) makes adding an `Action` to `rbac.ts` without a matching `case` here a compile error, so
the two can't drift apart.

**Multi-role composition.** Hard prohibitions (no private adult↔child messaging, no
self-approval, audit trails are immutable) are checked _before_ any role-based grant and deny
unconditionally, regardless of what else the actor's roles would otherwise permit. Everything
else is allowed if **any** role the actor holds grants it — e.g. a `finance + parent` actor can
still read an academic message via the parent grant, even though the finance role alone would not
grant it. Tests in `apps/web/tests/auth/authorize.test.ts` exercise this with pure single-role
actors specifically so the acceptance criteria stay unambiguous.

**Relationship facts, not queries.** `resource.tutorAssignment` is shaped exactly like a
`tutor_student_assignments` row (`{ status, endAt }`); `authorize()` re-applies the same
activeness rule documented in `packages/db/README.md` ("Tutor access is time-bounded, not
role-based"): active only while `status === "active"` **and** (`endAt` is `null` or in the
future). This package can't import `@app/db` to share that logic directly, so this function is
the canonical authorization-time implementation of the rule — the caller's only job is to fetch
the row and pass it through unmodified. Similarly `resource.parentLinked` should come straight
from a `parent_student_links` existence check.

**Callers must still log.** `authorize()` only returns yes/no. For actions the spec requires to be
logged — `message.access_as_staff` (needs `admin_access_reasons`), any export, role change,
deletion, or refund — the caller is responsible for writing that row / calling `@app/audit`'s
`recordAudit()` in addition to checking `authorize()`. `reasonProvided`/`amountMinor` on the
`resource` only feed the yes/no decision, they don't write anything.

### Permission matrix

Legend: ✅ = allowed, — = denied, **SU** = allowed but requires step-up (a _fresh_
`actor.mfaVerifiedAt`, per `isMfaFreshEnough` — not merely verified at login),
"own"/"linked"/"assigned" = requires the matching relationship fact.

| Action                                                  | parent | student | tutor    | finance | administrator | super_administrator       |
| ------------------------------------------------------- | ------ | ------- | -------- | ------- | ------------- | ------------------------- |
| `account.create` (target: student)                      | ✅     | —       | —        | —       | ✅            | ✅                        |
| `account.create` (target: other role)                   | —      | —       | —        | —       | ✅            | ✅                        |
| `account.suspend`                                       | —      | —       | —        | —       | ✅            | ✅                        |
| `student.view_profile` / `academic.view_record`         | linked | own     | assigned | —       | ✅            | ✅                        |
| `student.manage_profile`                                | linked | —       | —        | —       | ✅            | ✅                        |
| `academic.edit_learning_plan`                           | —      | —       | assigned | —       | ✅            | ✅                        |
| `message.send` (member, not private-adult-child)        | ✅     | ✅      | ✅       | ✅      | ✅            | ✅                        |
| `message.read` (non-academic, member)                   | ✅     | ✅      | ✅       | ✅      | ✅            | ✅                        |
| `message.read` (academic, member)                       | ✅     | ✅      | ✅       | —       | ✅            | ✅                        |
| `message.access_as_staff` (reason logged)               | —      | —       | —        | —       | ✅            | ✅                        |
| `finance.view_transactions` / `finance.generate_payout` | —      | —       | —        | ✅      | ✅            | ✅                        |
| `finance.refund` (< $200)                               | —      | —       | —        | ✅      | ✅            | ✅                        |
| `finance.refund` (≥ $200, "large")                      | —      | —       | —        | **SU**  | **SU**        | **SU**                    |
| `admin.approve_user` (not self)                         | —      | —       | —        | —       | ✅            | ✅                        |
| `admin.manage_roles` (not self)                         | —      | —       | —        | —       | —             | **SU**                    |
| `export.data`                                           | —      | —       | —        | —       | ✅            | ✅                        |
| `export.bulk`                                           | —      | —       | —        | —       | **SU**        | **SU**                    |
| `audit.view`                                            | —      | —       | —        | —       | **SU**        | **SU**                    |
| `audit.erase`                                           | —      | —       | —        | —       | —             | — (always, no exceptions) |
| `deletion.execute`                                      | —      | —       | —        | —       | **SU**        | **SU**                    |
| `security.configure`                                    | —      | —       | —        | —       | —             | **SU**                    |

Hard prohibitions that override the table above regardless of role:

- **No private adult↔child messaging.** `message.send`/`message.read` deny unconditionally if
  `resource.isPrivateAdultChildChannel === true`, even for staff. (The conversation schema itself
  has no such type — this is defense in depth.)
- **No self-approval.** `admin.approve_user`/`admin.manage_roles` deny if
  `resource.targetUserId === actor.userId`, regardless of role (spec §4.6: "one cannot silently
  approve their own high-risk action").
- **Audit trails are immutable.** `audit.erase` always denies — there is no allow branch, for any
  role, ever. (Also enforced at the database level: `packages/db` migration `0001` installs a
  `BEFORE UPDATE OR DELETE` trigger on `audit_events`.)
- **Students cannot create accounts.** `account.create` denies unconditionally if the actor holds
  the `student` role, even combined with another role.

**Role model note:** `packages/db/src/schema/identity.ts`'s `roles` table is a dynamic catalog
(super-admin can configure roles/permissions per spec §4.6), while `Role` here is the fixed
6-member MVP union spec §4 defines. The caller is responsible for mapping a DB `roles.key` to one
of these literals before building an `Actor`; a `roles.key` that doesn't map to a known `Role`
must resolve to **no grant**, not be passed through or ignored silently.

## Login flow

`login({ user, password, mfaVerifiedThisAttempt })` is pure (no DB/Redis) and returns a discriminated
`LoginResult`:

1. Verifies the password. If `user` is `null` (no account matched), a dummy argon2id hash is
   verified anyway so the response time doesn't reveal account existence.
2. Checks account status (`suspended` → `account_suspended`, `deleted` → `account_deleted`,
   `pending` → `account_pending`).
3. Runs `assertMfaSatisfied` against the account's roles/MFA state.
4. On success, returns `{ ok: true, userId, roles }` — the caller then calls `createSession` and
   writes a `login_events` row (both outside this package's I/O boundary).

## Wiring this into a route handler (informational — not implemented here)

1. Look up the `LoginCandidate` from `@app/db`, call `login()`.
2. On success, construct the Redis client from `@app/config`'s `serverEnv.REDIS_URL` and call
   `createSession` — pass `mfaVerifiedAt: new Date()` if `attempt.mfaVerifiedThisAttempt` was true,
   otherwise `null`; set the returned cookie via `next/headers`' `cookies().set(...)`.
3. On every protected request: read the session cookie, `getSession`, verify CSRF for
   state-changing requests via `verifyCsrfToken`, then build `Actor.mfaVerifiedAt` from
   `session.mfaVerifiedAt` and call `authorize()` before touching any domain logic.
4. For high-risk actions (see the permission matrix's **SU** cells), check `isMfaFreshEnough`
   first; if stale, re-prompt for a TOTP/recovery code, call `recordStepUpMfaVerification` on
   success, re-fetch the session, and only then call `authorize()`.
