# Reporting

This module generates first-party, cohort-level product, operational, and academic reports. It is
an internal administrator surface, not a child-facing analytics product and not an advertising
pipeline.

## Report boundaries

- Weekly reports cover the last fully completed UTC Monday–Monday interval.
- Monthly reports cover the last fully completed UTC calendar month.
- The weekly job runs Monday at 02:10 UTC. The monthly job runs on day 1 at 03:10 UTC.
- Jobs are idempotent at the repository boundary: the report key is
  `<cadence>:<period-start>:<period-end>`, and an existing append-only snapshot is returned instead
  of regenerated.
- Scheduled snapshots and the minimal first-party funnel event stream use the existing append-only
  `audit_events` store. Snapshots contain aggregates only.
- API responses are private, non-cacheable, and opt out of browser geolocation, camera, microphone,
  and Topics capabilities.

## Metric definitions

All rates are `numerator / denominator × 100`. UTC start boundaries are inclusive and end
boundaries are exclusive. A metric with no denominator is shown as unavailable. A non-empty cohort
smaller than five is suppressed: its value, numerator, denominator, and sample size are all omitted.

### Funnel

The funnel uses a rotating, one-way, first-party subject key. Events for a stage are accepted only
after the same key has reached the preceding stage. The 30-day stage must be at least 30 days after
payment, and the 90-day stage must be at least 90 days after payment (as well as after the recorded
30-day stage). Stage counts are unique keys whose qualifying stage event occurred in the report
period.

| Metric           | Definition                                                           |
| ---------------- | -------------------------------------------------------------------- |
| Visitor          | Unique subject keys with a visitor event                             |
| Consultation     | Keys with consultation after visitor                                 |
| Trial            | Keys with trial after consultation                                   |
| Paid             | Keys with payment after trial                                        |
| 30-day retention | Keys with a qualifying retained event at least 30 days after payment |
| 90-day retention | Keys with a qualifying retained event at least 90 days after payment |

The conversion displayed beside a stage is its period count divided by the preceding stage's
period count. A subject key is a measurement join key only: it cannot be an IDFA, GAID, ad-cookie
identifier, device fingerprint, email, phone number, or raw account ID, and it must not be sent to
another service. The system that derives the key should rotate it after the 90-day measurement
window.

### Operational

| Metric                  | Numerator                                            | Denominator                                                  |
| ----------------------- | ---------------------------------------------------- | ------------------------------------------------------------ |
| Tutor attendance        | Lessons with a tutor join                            | Due, non-canceled lessons where a tutor was expected         |
| Student attendance      | Present or late places                               | Expected student places on due, non-canceled lessons         |
| Missing feedback        | Completed lessons without published/revised feedback | Completed lessons                                            |
| Cancellation rate       | Canceled lessons                                     | All lessons due in the period, excluding rescheduled rows    |
| Support resolution rate | Tickets reaching resolved/closed                     | Tickets opened in the period                                 |
| Support resolution time | Sum of creation-to-resolution hours                  | Resolved tickets                                             |
| Utilization             | Delivered completed-lesson minutes                   | Recurring availability, adjusted for availability exceptions |
| Margin per lesson       | Captured revenue less non-void tutor earning         | Completed lessons with both values, grouped by currency      |
| Payment failure rate    | Failed charge transactions                           | Succeeded plus failed charge transactions                    |
| Refund rate             | Completed refunds                                    | Successful charge transactions                               |

Amounts are integer minor currency units in the aggregate engine. Currencies are never combined.
The UI formats each currency bucket separately.

### Academic

All academic values are cohort aggregates. Direct student keys are used only while grouping facts
in memory and are absent from the report snapshot.

| Metric                           | Definition                                                                                              |
| -------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Baseline                         | Mean first normalized diagnostic score for each learner-and-subject pair with at least two measurements |
| Follow-up                        | Mean latest diagnostic score for the same paired cohort                                                 |
| Baseline vs follow-up            | Mean learner-level follow-up minus baseline, in percentage points                                       |
| Milestone completion             | Completed milestones divided by milestones updated in the period                                        |
| Plan progress                    | Completed items divided by all items on active learning plans                                           |
| Accuracy trend                   | Mean latest minus first normalized assessment accuracy by learner and subject                           |
| Rubric improvement               | Mean latest minus first normalized rubric score by learner and criterion                                |
| Self-reported school performance | Mean normalized learner-reported value, explicitly labeled self-reported                                |

The self-reported school-performance metric is not an observed grade, a predicted grade, or a
claim of causality. The dashboard keeps that label attached to the value.

## Analytics privacy boundary

Allowed:

- first-party funnel transitions needed to measure the service;
- transactional lesson, attendance, feedback, support, payment, and refund records;
- aggregate diagnostic, plan, milestone, assessment, and rubric evidence;
- a clearly labeled self-report supplied for academic progress review;
- cohort-level administrator reports with small-cell suppression.

Never allowed:

- advertising identifiers or profiles, IDFA, GAID, GCLID, FBCLID, or cross-site cookies;
- product-funnel collection in a child account;
- combining a child's learning record with an advertising profile;
- precise latitude/longitude, biometrics, faceprints, voiceprints, or device fingerprints;
- scroll depth, dwell time, focus time, an “engagement score,” or other manipulative attention
  analytics;
- raw names, emails, phone numbers, IP addresses, user-agent strings, or direct identifiers in a
  report snapshot.

`parsePrivacySafeFunnelEvent()` recursively rejects prohibited field names before persistence and
rejects every event whose account context is `child`. The ingestion API is authenticated and
administrator-only. There is deliberately no reporting beacon, SDK, script tag, or child-area
caller.

## Main entry points

- `generateReportingSnapshot()` is the deterministic pure aggregation function used by tests.
- `generateAndStoreReportingSnapshot()` loads facts and writes an idempotent scheduled snapshot.
- `createDrizzleReportingRepository()` projects existing transactional tables into reporting
  facts and writes append-only snapshots/events.
- `apps/worker/src/jobs/reporting/generate-reports.job.ts` registers weekly and monthly jobs.
- `GET /api/reporting?cadence=weekly|monthly` returns the last completed period.
- `POST /api/reporting/events` accepts privacy-checked, administrator-recorded funnel transitions.
