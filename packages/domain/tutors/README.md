# Tutors domain

This slice owns the tutor’s editable profile, subjects, grade ranges, languages, weekly
availability, verification documents, and the read models for verification, evaluations,
training, and suspensions.

## Visibility and verification

- A public profile exists only when `tutor_profiles.status = active` **and**
  `public_profile_approved_at` is present. Its projection intentionally contains only approved
  profile fields plus teaching capabilities. It never contains documents, verification records,
  evaluation comments, training, suspensions, user ids, or file keys.
- Verification is structured by check type and status. The presence of a tutor profile does not
  imply a criminal-background check; that claim is valid only if a `background_check`
  verification record explicitly says so.
- `reviewTutorVerification()` delegates the approval decision to `@app/auth` with the tutor as
  the target user. Its hard `cannot_self_approve` rule therefore applies even when a tutor also
  has an administrator role.

## Document upload

`uploadTutorDocument()` accepts PDF, JPEG, and PNG only (10 MiB maximum), validates magic bytes,
and writes a non-public S3 key under `private/tutors/...`. The corresponding DB record remains
`pending`, meaning quarantined, until review. Downloads use a short-lived HMAC-signed application
URL which streams the private object; no S3 public URL or ACL is produced.

## Scheduling (D5) availability contract

D5 consumes `tutorAvailabilityForScheduling(database, tutorProfileId, { startAt, endAt })` as a
read-only availability source. It returns this shape:

```ts
{
  tutorProfileId: string,
  windows: Array<{
    startsAt: Date, // UTC instant
    endsAt: Date,   // UTC instant; interval is [startsAt, endsAt)
    timeZone: string, // IANA zone used to interpret the tutor's weekly rule
    source: "recurring",
    ruleId: string,
  }>
}
```

Weekly rules are stored with the tutor account's IANA zone and projected to exact UTC instants for
the requested range, including DST conversion. The maximum query range is 92 days. A returned
window means only “the tutor offered this time”; it is not a hold or booking. D5 must intersect it
with duration/buffer rules, existing lessons, and its one-time availability/blackout overlay. D5
owns those one-time overlays and must keep their exact UTC `startsAt`/`endsAt` values separate
from recurring tutor rules.
