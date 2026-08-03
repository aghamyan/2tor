# @app/db

The complete database schema for the platform, as Drizzle ORM tables — one file per product
domain, a generated SQL migration history, and a deterministic dev seed. Every other package and
app reads this schema; nothing outside `packages/db` may modify it (see
[docs/CONVENTIONS.md](../../docs/CONVENTIONS.md)).

## Layout

```
src/
  schema/
    _common.ts        Shared column builders (ULID PK, UTC timestamps, money, currency enum, ...)
    identity.ts        users, roles, user_roles, sessions, mfa_methods, login_events, password_reset_tokens
    families.ts         parent/student profiles, parent_student_links, consent, privacy requests
    tutors.ts            tutor profile + capabilities + verification/training/suspension trail
    matching.ts           tutor↔student assignment (the source of truth for tutor access)
    scheduling.ts          lesson series/lessons/attendance/cancellations/Zoom
    academic.ts              subjects, courses, learning plans, skills, tutor notes, lesson feedback
    assignments.ts            homework: assignments, submissions, grading, rubrics
    assessments.ts             quizzes/exams/diagnostics + anti-cheating event log
    milestones.ts               longer-horizon progress markers + rewards
    projects.ts                  project-based learning + portfolio
    content.ts                    resource library
    communication.ts               conversations/messages + discussion spaces
    gamification.ts                 points/levels/badges/streaks/challenges
    finance.ts                       prices, charges, invoices, payouts, exchange rates
    operations.ts                     notifications, support, incidents, audit, exports, deletion, flags
    index.ts                          barrel — re-exports every table/enum from every file above
  client.ts             process-wide `createDb(connectionString)` pool + transaction helper
  seed.ts                idempotent dev seed
drizzle.config.ts        points drizzle-kit at src/schema/index.ts, outputs to ./migrations
migrations/               generated SQL + one hand-written custom migration (audit_events trigger)
```

123 tables total, matching the product spec §15 entity list exactly (7+7+10+3+7+13+8+7+4+7+7+10+8+13+12
across identity/families/tutors/matching/scheduling/academic/assignments/assessments/milestones/
projects/content/communication/gamification/finance/operations).

## Commands

```bash
pnpm --filter @app/db db:generate   # diff schema/*.ts against migrations/, write new SQL
pnpm --filter @app/db db:migrate    # apply pending migrations to DATABASE_URL
pnpm --filter @app/db migrate:check # drizzle-kit check — verifies migration history is consistent
pnpm --filter @app/db seed          # idempotent dev seed (safe to run repeatedly)
pnpm --filter @app/db typecheck     # tsc --noEmit
```

All of the above read `DATABASE_URL`, falling back to
`postgres://postgres:postgres@localhost:5432/app` (see `.env.example` at the repo root).

## Invariants every downstream task must respect

These are enforced by convention and (where noted) by the database itself — read this before
writing a migration or a query against this schema.

### IDs

Every primary key is a ULID stored as `text`, generated in the app layer via
`ulidPk()` in `_common.ts` (`$defaultFn(() => ulid())`). Never use `serial`/`uuid`. Foreign key
columns use the `ulidFk(name)` helper (a bare `text` column — nullability and `.references()` are
added at the call site).

### Timestamps: UTC + per-user IANA zone

Every timestamp column is `timestamp with time zone` via `utcTimestamp(name)` /
the `timestamps` (`createdAt`/`updatedAt`) helper in `_common.ts` — Postgres always stores and
compares these in UTC. **Never** add a naive (no-timezone) timestamp column. Per-user display
timezone is a separate `text` column holding an IANA zone name (`ianaTimezone()`), e.g.
`users.primary_timezone`; convert at render time only, never in the database. Where a booking's
timezone matters historically (e.g. `lessons.timezone_at_booking`), it's snapshotted at write
time — the user's `primary_timezone` can change later without rewriting history.

### Money: integer minor units + explicit currency, always

Every money column is a `bigint` (`minorUnits(name)` in `_common.ts`) paired with a `currency`
column (`currencyEnum`, currently `"USD" | "AMD"`). `bigint` (not `int4`) is used uniformly, even
for line items that would fit in `int4`, because AMD payout aggregates (100 luma/AMD) can approach
the `int4` ceiling — one rule applied everywhere beats per-column judgment calls. **Never** use a
floating-point type for money, and never add a money column without its paired `currency` column.

**Historical price/compensation is copied, not referenced.** `lesson_charges.amount_minor` and
`tutor_earning_entries.amount_minor` are snapshots taken at charge/earning time from `prices` /
the tutor's rate — they do **not** recompute if `prices` changes later. If you need "what did this
cost," read the charge/earning row, not the current price.

### Tutor access is time-bounded, not role-based

`tutor_student_assignments` is the single source of truth for "can this tutor see this student."
A tutor's access is valid only while a row exists with `status = 'active'` **and**
(`end_at IS NULL OR end_at > now()`). Every authorization check that gates tutor→student data
access must query this table — don't infer access from the existence of lessons, assignments, or
messages.

### Versioning

- `learning_plans` — full history lives in `learning_plan_versions` (`snapshot` jsonb +
  `version_number`); the tutor edits `learning_plans` directly for day-to-day changes, and a new
  `learning_plan_versions` row should be written whenever a material change happens.
- `lesson_feedback` — spec §15 lists no separate feedback-versions table, so this is versioned
  in place via `version` (int) + `supersedes_feedback_id` (self-FK): a correction inserts a new
  row pointing at the one it supersedes rather than mutating the original.
- `assessments` — versioned via `assessment_versions`, so editing a published assessment never
  changes the paper a past `assessment_attempts` row was actually taken against.

### `audit_events` is append-only — enforced by a trigger, not just convention

Application code must never `UPDATE` or `DELETE` an `audit_events` row. This is enforced in the
database itself: migration `0001_audit_events_immutable.sql` installs a `BEFORE UPDATE OR DELETE`
trigger that raises an exception unconditionally, regardless of DB role. If you need to correct an
audit entry, insert a new row referencing the old one — don't try to fix the trigger.

### Soft-delete flags are not the privacy deletion mechanism

A handful of tables have a `deletedAt`/status-based soft-delete flag (e.g. `users.deleted_at`).
That flag is for ordinary lifecycle/visibility purposes only. Actual privacy-driven erasure or
anonymization is tracked and executed via `deletion_jobs` (optionally linked to a
`privacy_requests` row) — a soft-delete flag being set does **not** mean the underlying data has
been erased, and erasing data does **not** go through the soft-delete flag.

### DOB minimization

`student_profiles` has three birth-date-related columns: `dob_exact` (optional, collect only when
legally/operationally justified), `dob_year_month` (`"YYYY-MM"`, the default minimization), and
`age_band` (fallback when even year/month isn't collected). Prefer the least-precise field that
satisfies the feature's actual need; `dob_exact` should stay empty by default.

### Foreign key delete behavior

Two patterns, chosen deliberately per relationship — don't default to one without thinking about
which applies:

- **`onDelete: "cascade"`** — used only where the child row is a pure detail/extension of its
  parent and has no independent meaning (e.g. `*_profiles` extending `users`; `invoice_items`
  under `invoices`; `assignment_questions` under `assignments`). Deleting the parent should delete
  these too.
- **`onDelete: "restrict"`** (or no `onDelete`, which is `NO ACTION` — effectively the same
  protection) — used everywhere a row references another as a business subject/actor across
  domains (e.g. `createdByUserId`, `tutorProfileId` on a lesson, `studentProfileId` on a grade).
  These must never silently cascade away; deletion of the referenced row has to go through
  `deletion_jobs` explicitly.

### Naming

Postgres enum types are globally namespaced (not per-table), so every `pgEnum` uses a
domain-prefixed SQL type name (e.g. `tutor_assignment_status`, not `assignment_status`, since
`assignments.ts` needed `assignment_publish_status` for homework). A few enums with identical
value sets are deliberately shared across domains instead of duplicated — e.g.
`virus_scan_status` (any uploaded-file table) and `content_report_status` (reused by
`abuse_reports.status`) both live in a single shared definition.

### Cross-file (and circular) references

Tables reference each other across domain files using Drizzle's lazy `.references(() => table.column)`
form. Several domain files import each other in both directions (e.g. `tutors.ts` ↔ `academic.ts`,
`assignments.ts` ↔ `projects.ts`) — this is intentional and safe: the callback defers evaluation
until after all modules finish loading, which is the standard pattern for circular relations
across ES modules. Do not "fix" an apparent import cycle by inlining a table into the wrong
domain file.

### Barrel completeness

`src/schema/index.ts` re-exports **every** domain file, including `_common.ts`. This isn't
cosmetic: `drizzle-kit generate` only emits `CREATE TYPE` for enums reachable from the schema
module passed via `drizzle.config.ts` (`./src/schema/index.ts`). An enum defined but not
re-exported from the barrel silently produces tables that reference a type that was never
created — this happened during authoring with `currency`/`virus_scan_status` and was caught by
applying the generated migration to a real Postgres instance, not by `drizzle-kit generate` or
`tsc` alone (both succeeded despite the missing type). If you add a new shared enum to
`_common.ts`, confirm `export * from "./_common"` stays in `index.ts`.

## Seed data

`pnpm --filter @app/db seed` inserts one coherent demo dataset — a parent, a student, a tutor, an
active tutor↔student assignment, a lesson (with attendance, feedback, a Zoom record), a learning
plan, a graded homework assignment, and a paid invoice with a matching tutor earning entry. Every
row uses a fixed id and every insert uses `.onConflictDoNothing()`, so the script is safe to run
against a database that's already been seeded — verified by running it twice against a fresh
Postgres and confirming row counts don't change on the second run. Seeded accounts use the
development-only password `DemoLogin!2026` with a real Argon2id hash so the local login UI
exercises production password verification. The parent demo login is `parent@example.com`; never
reuse these credentials outside a disposable development environment.

Domains with no seed rows (assessments, milestones beyond the core story, projects, content,
communication, gamification, most of operations) are intentionally left empty — the acceptance
scope for this seed is the parent/student/tutor/assignment/lesson/invoice golden path, not full
table coverage.
