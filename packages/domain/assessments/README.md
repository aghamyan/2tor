# Assessments

This slice supports versioned tutor-authored assessments, question pools, deterministic
per-attempt question/choice/value randomization, timed and fullscreen modes, answer history,
and tutor-written diagnostic reports.

## Signals are not proof

`assessment_events` is an append-only activity log for tutor review. It records lifecycle events,
answer timestamps and changes, focus or tab loss, fullscreen exits, connectivity interruptions,
and detectable copy/paste attempts. These entries are context signals only:

- no event, count, or pattern creates an accusation or verdict;
- a tab switch is recorded exactly like the other review signals and does not set a status flag;
- tutors review signals alongside answers and can follow up with the student;
- students see the collection notice before an attempt starts and accept an honor statement before
  submitting.

Downstream analytics, notifications, and reviewer interfaces must preserve this contract. They may
summarize event counts, but must not convert them into a guilt label, risk verdict, or automated
disciplinary action.

## Camera boundary

A version may request a camera only when it names a policy version. Starting that version requires
both an active consent record for `assessment_camera:<policyVersion>` and an explicit acknowledgment
in the start request. This slice contains no recording, face identification, or emotion analysis.

## Diagnostic report release

The report is written by the assigned tutor. It remains unavailable to the linked parent until the
tutor records that the consultation occurred and deliberately releases the report.

## Existing-schema compatibility

The current database schema predates several Phase-2 settings. The Drizzle adapter stores version
settings and the report release lifecycle in versioned JSON envelopes inside their existing text
fields, and stores the canonical event type in event metadata when the database enum has no direct
value. Service callers always receive the canonical domain model. Replace these envelopes with
dedicated columns in a future database-owned migration without changing the service contract.
