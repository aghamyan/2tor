# Scheduling domain

This slice owns lesson series (recurring) and lessons (one-time or materialized from a series),
the Zoom join/passcode record per lesson, attendance, completion, cancellation/no-show, and the
reminder/chargeable-event queries other modules consume. It never touches billing, payouts, or
academic feedback — see "Cross-module contracts" below for the exact seams.

## Time-zone-safe scheduling

- All persisted timestamps (`lessons.scheduled_start_at/scheduled_end_at`) are UTC. Each lesson
  also snapshots the IANA zone in effect at booking time (`timezone_at_booking`) for honest
  historical display — spec §15's "convert only at render time" applies going forward, not
  retroactively to a zone that may have changed.
- A recurring series (`lesson_series`) stores its pattern — weekday(s), local wall-clock hour and
  minute, IANA zone, and week interval — packed into `recurrence_rule` (see `recurrence.ts`'s
  `serializeRecurrencePattern`/`parseRecurrencePattern`). `lesson_series.start_date`/`end_date`
  (date-only columns already on the table) bound the calendar range; the packed string only needs
  the pattern itself.
- `expandOccurrences()` computes every occurrence's UTC instant **independently**, by converting
  that occurrence's own local calendar date + wall-clock time through `zonedTimeToUtc()` (a
  guess-and-correct conversion using `Intl.DateTimeFormat`, no timezone-database dependency). It
  never derives occurrence N+1 by adding a fixed `7 * 24h` (or `interval * 7 * 24h`) to occurrence
  N's UTC instant — that would silently produce the wrong wall-clock time across a DST boundary.
  This is the property `apps/web/tests/scheduling/recurrence.test.ts` asserts directly (occurrence
  gaps of 167h/169h across the spring-forward/fall-back boundaries, not a constant 168h), and
  `apps/web/tests/scheduling/services.test.ts` re-asserts end-to-end through `createLessonSeries`.
- `materializeUpcomingLessons()` (called at series-creation time and again by the daily
  `scheduling.materialize-lessons` worker job) extends how far ahead a series has concrete
  `lessons` rows, deduplicating against already-materialized start times. It infers lesson
  duration from the series' most-recently-materialized lesson (`lesson_series` has no duration
  column) — a series with zero materialized lessons yet (an edge case: its `start_date` is further
  out than every horizon applied so far) is skipped until one exists.

## Zoom link/passcode

Manual entry only in the MVP, behind the `ZoomLinkProvider` interface (`zoom.ts`) — spec: "manual
entry now, Zoom API behind a pluggable interface for later." `setLessonZoomMeeting()` calls
whichever provider is injected (`createManualZoomLinkProvider()` by default); swapping in a real
Zoom-API-backed provider later (one that calls Zoom's Create Meeting API and ignores the manual
entry fields) changes zero calling code.

## Cancellation policy

`cancellation-policy.ts`'s `computeCancellationCharge()` is the single, pure, unit-tested
implementation of spec §5.4's defaults (`DEFAULT_CANCELLATION_POLICY`: 8-hour free window, 50%
late-individual charge, 100% group-absence charge), overridable per call for an
admin-configurable policy. Both write-time callers (`cancelLesson`/`recordNoShow` in `services.ts`,
which persist a `cancellations` row) and the read-time query (`getChargeableLessonEvents()` in
`chargeable-events.ts`, below) call this same function — they cannot drift apart.

Precedence, in order:

1. **Tutor-initiated** (cancellation or no-show) → never chargeable. "No student charge;
   replacement lesson or credit" — issuing that credit/replacement is Payments' concern, not
   this module's.
2. **`technical_issue` category** → never chargeable (platform's fault, not the family's).
3. **Trial lessons** → never chargeable (spec §2.3 offers the trial free).
4. **Group lessons** → a student absence (cancellation or no-show) is a full charge **regardless
   of notice** — the class runs for the other students either way, so there's no "unused tutor
   slot" the notice window is meant to price in.
5. **Individual lessons** → a no-show is always treated as a late cancellation, independent of
   the computed notice window. Otherwise: ≥8 hours' notice is free, less than 8 hours is a 50%
   charge.

The `cancellations` table has only a `charge_applied` boolean, not a percentage — deliberately not
persisted, since adding a column isn't allowed in this slice. `getChargeableLessonEvents()`
recomputes the percentage from stored facts on every call instead, which also means a future
policy-config change is reflected by re-running the query over historical rows, not a backfill.

## Cross-module contracts

### Chargeable-event contract (Payments / D14)

**Scheduling never inserts into `lesson_charges`, `payment_transactions`, or any other finance
table.** The entire interface to Payments is one read-only query:

```ts
import { getChargeableLessonEvents } from "packages/domain/scheduling/chargeable-events";

const events = await getChargeableLessonEvents(db, { since: lastPolledAt });
```

- Returns one `ChargeableLessonEvent` per cancellation/no-show that currently owes a charge:
  `lessonId`, `cancellationId`, `tutorStudentAssignmentId`, `lessonKind`
  (`"individual" | "group" | "trial"`), `category`, `chargePercentage` (e.g. `50`/`100`, never
  `0`), `reasonCode`, `scheduledStartAt`, `canceledAt`, `canceledByUserId`.
- **A zero-charge outcome (tutor-initiated, trial, technical issue, ≥8h notice) produces no row at
  all** — not a row with `chargePercentage: 0`. Payments can treat "not present in the result" as
  "not chargeable" without inspecting a percentage field. This is what
  `apps/web/tests/scheduling/services.test.ts`'s "produces no charge for a tutor-initiated
  cancellation" case and `cancellation-policy.test.ts`'s equivalent pure-function case both prove.
- `filter.since` lets Payments poll incrementally; `filter.lessonIds` lets it reconcile a specific
  lesson/invoice. `lessonId` is unique per `lesson_charges` row (see `packages/db/src/schema/
finance.ts`), so Payments can safely upsert-if-not-exists keyed on `lessonId` — this query is
  safe to call repeatedly over overlapping time ranges.
- Payments owns converting `chargePercentage` into an actual `amount_minor`/`currency` (looking up
  the lesson's price) and everything downstream (invoices, refunds). This module has no opinion on
  money.

### Missed-feedback hook (Academic / D6)

`getRecentlyCompletedLessons()` (`feedback-hook.ts`) returns lessons whose status has been
`"completed"` for at least N hours. Scheduling has no visibility into whether feedback was
actually submitted — `lesson_feedback` is Academic's table — so D6 is expected to left-join this
list against its own feedback table to find which lessons are still missing feedback, then alert
per spec §5.2 ("Admin is alerted if feedback is missing after the defined deadline").

## Authorization model

There is no `@app/auth` `Action`/`Resource` entry for scheduling-specific operations (adding one
would require editing `packages/auth`, outside this slice's allowed files). `services.ts` instead
implements its own actor/relationship checks directly against `tutorStudentAssignments`/
`parentStudentLinks` — the same pattern `packages/domain/families/services.ts` uses for the same
reason. `SchedulingRole` mirrors `@app/auth`'s `Role` union exactly (including `"finance"`, which
grants no scheduling access) purely so an `Actor` from `@app/auth` is structurally assignable to
`SchedulingActor` at the web boundary without a conversion step.

Summary:

- **Schedule/reschedule/cancel/complete/attendance/Zoom writes**: the assignment's own tutor, or
  staff (`administrator`/`super_administrator`).
- **Reschedule inside the free-cancellation notice window** (< 8h by default): tutor or staff
  only — a parent/student needs ≥8h notice, mirroring the free-cancellation threshold.
- **Cancellation category** is restricted by who's cancelling (`allowedCategoriesFor()` in
  services.ts) — a parent cannot submit `category: "tutor_request"` to dodge a charge; a tutor
  cannot submit `"parent_request"`.
- **No-show recording**: tutor or staff only (spec §5.2: "Tutor marks attendance and completion").
- **Reads** (`getLessonDetail`, `listLessonsForActor`): the assignment's tutor, the student
  themself, a linked parent, or staff.

## Known limitations

- **Reminder preferences collapse to one toggle.** Spec §17 lists "24-hour reminder" and "1-hour
  reminder" as independently configurable. `@app/notifications`'s `notificationCategory()` maps
  every `"lesson_reminder"` notification to the single `"schedule"` category
  (`packages/notifications/src/dispatch.ts`), so one `notification_preferences` row gates both
  windows — there's no way to let a family opt into one but not the other without a schema or
  `@app/notifications` change, both outside this slice's allowed files.
- **Web-push reminders can collide between the two windows.** `notifications.send-push`'s
  idempotency key (`apps/worker/src/jobs/notifications/send-push.job.ts`) is
  `${userId}:${type}:${endpoint}:${rendered.version}` — it doesn't vary with the rendered body, so
  a lesson's 24h and 1h push reminders would be deduplicated as if one were a retry of the other.
  Email and in-app inbox don't have this problem (their idempotency keys incorporate the rendered
  body, which `send-reminders.job.ts` deliberately varies per window). In practice this is moot
  today: `packages/db` has no web-push-subscription table yet, so push delivery for reminders is
  always skipped regardless.
- **No shared `@app/notifications` composition root exists yet.** Nothing in this repo currently
  calls `configureNotifications()`. `apps/worker/src/jobs/scheduling/_notifications.ts` wires a
  scheduling-scoped `NotificationRepository` itself, since this slice can't touch
  `apps/worker/src/index.ts` or `packages/notifications` to add a shared one. Moving this to a
  real composition root later is a drop-in change — `notify()` call sites don't change.
- **Group lessons have no dedicated "group" flag.** A lesson's kind (`individual`/`group`/`trial`)
  is derived from `isTrial` plus a count of `lesson_participants` rows with `role = "student"` (see
  `lessonKindFrom()`), since `lessons` has no such column and this slice cannot add one.
- **Admin-initiated (`admin_action`) cancellations follow the same notice-based policy as
  parent-initiated ones** (no special "always waived" or "always charged" handling). This is a
  reasonable MVP default, not a spec requirement — revisit if staff need a distinct override path.

## Testing

- `recurrence.test.ts` — DST correctness (spring-forward and fall-back boundaries), the
  serialize→parse→expand round-trip, interval/multi-weekday handling, and `zonedTimeToUtc`.
- `cancellation-policy.test.ts` — every branch of `computeCancellationCharge()` against the spec
  §5.4 defaults, including a configured-policy override.
- `services.test.ts` — the same policy outcomes exercised through the actual service functions
  (`cancelLesson`, `recordNoShow`) against an in-memory `SchedulingDatabase`
  (`apps/web/tests/scheduling/support/in-memory-scheduling-database.ts`), plus scheduling,
  rescheduling, attendance/completion, Zoom entry, and relationship-scoped authorization.
- `reminders.test.ts` — the pure `reminderWindowBounds()` tolerance-band math.
- `chargeable-events.test.ts` — `computeChargeableLessonEvents()`, the pure map-and-filter core of
  `getChargeableLessonEvents()` (split out of the DB-querying wrapper specifically so it doesn't
  need a live Postgres connection to test). This is where acceptance criterion #2 is verified at
  the level it's written about — the emitted event list itself, not just the underlying
  `computeCancellationCharge` percentage or the `cancellations.charge_applied` boolean: a <8h
  individual cancellation asserts `chargePercentage: 50` in the returned array, and a tutor
  cancellation / tutor no-show asserts an **empty** array, exactly matching "produces none."
  `getChargeableLessonEvents()`'s own DB-fetching half (the two `@app/db` queries it wraps) is
  intentionally left without a dedicated test, matching `packages/domain/families/integrity.ts`'s
  precedent for `@app/db`-direct queries in this repo — the same is true of `feedback-hook.ts`.
