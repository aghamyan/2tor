# Payouts domain

This slice owns the tutor earnings ledger, AMD monthly payout batches, payout items, completion
evidence references, and the finance CSV export. It uses the existing finance schema; no money is
stored as a floating-point number.

## Earning-entry contract

`LessonEarningSource.listLessonEarningEvents()` is the boundary with completed/chargeable lesson
processing (D5). It must return exactly one event for each lesson that owes tutor compensation:

- `lessonId` and `tutorProfileId`;
- whether the outcome is `completed` or otherwise `chargeable`;
- the immutable full compensation rate that applied at earning time, in integer minor units;
- the payout percentage for the outcome (for example, 50 for a chargeable late cancellation);
- the earning timestamp and trial marker.

`recordLessonEarnings()` is idempotent by lesson ID. It copies the historical compensation into a
new `tutor_earning_entries` row and never recalculates an existing entry from a current rate. A 50%
outcome copies a rounded 50% amount into the entry. When D5 is unavailable,
`createFixtureLessonEarningSource()` supplies the same boundary shape for tests and the monthly
worker payload.

New entries begin as `pending`. Finance approval moves them to `approved`; only approved,
unbatched entries are eligible for a monthly payout batch.

## Trial payout policy

Current policy pays no tutor compensation for trial lessons. The behavior is controlled by
`PayoutPolicyConfig.payTrialLessons`, with `DEFAULT_PAYOUT_POLICY.payTrialLessons === false`.
Runtimes may set `PAYOUT_PAY_TRIAL_LESSONS=true` through `payoutPolicyFromEnvironment()` if the
recruitment policy changes. Tests cover both settings.

## Monthly batches and FX

Every monthly batch is denominated in AMD luma (100 luma = 1 AMD). Creation requires an FX
snapshot with base/quote currency, decimal rate, human-readable source, and conversion date.
Conversion uses decimal integer arithmetic and half-up rounding.

The selected snapshot is written to `exchange_rates` and to an append-only
`payout.batch.fx_recorded` audit event keyed to the batch. This makes the exact source/rate/date
recoverable per batch without changing the existing payout table. Batch creation checks that the
sum of generated payout items exactly matches `payout_batches.total_amount_minor`.

Finance completes an external payout only with a durable evidence attachment reference. That
reference is copied onto every payout item and included in the CSV export.

## Authorization boundary

Finance and administrators may read the internal ledger, including company price and computed
margin when currencies match. Tutors receive `TutorEarningsSummary`, a deliberately separate DTO
containing only their completed/chargeable counts, expected totals, and own earning lines. It has
no company-price or margin fields.
