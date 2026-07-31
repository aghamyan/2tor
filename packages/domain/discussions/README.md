# Learning Questions domain

Learning Questions is a bounded, moderated Q&A space. It is intentionally not a messaging
system: there are questions, answers, optional quarantined question attachments, and a small
helpful-answer signal. There are no recipients, inboxes, direct-message routes, anonymous actor
types, or public-read methods in this slice.

## Safety and access model

- Every service entry point requires a signed-in `DiscussionActor` with a non-empty user ID.
  `createQuestion` additionally requires the actor to be the student represented by
  `studentProfileId`; author names are loaded from `getSafeDisplayIdentity`, then rendered only
  as `first name · controlled identifier`.
- A question is scoped to at least one course, group, or subject. `private_support` is limited
  to that student, their linked parent, their assigned tutor, and staff. `group_shared` requires
  a group and is limited to group members, tutors assigned to that group, and staff.
- Students and tutors can answer only where they already have question access. Student answering
  additionally requires the repository's `isApprovedStudentAnswerer` check. Every answer begins
  as `unverified`; only a responsible tutor or staff member can call `verifyAnswer`.
- Posts are never public objects: there is no public listing/read service and this module exports
  no metadata intended for search indexing. The web page sets `noindex, nofollow` as defense in
  depth.
- `detectPii` flags likely email, phone, street-address, and government-ID patterns without
  retaining the matched value. A flagged question is placed in `pending_moderation` for tutor
  review; a responsible tutor can explicitly reopen it or close it with `moderateQuestion`.

## Attachments, voting, and SLA

Question attachments accept only JPEG, PNG, and PDF bytes after server-side signature and size
checks; JPEG/PNG metadata is stripped before private quarantine storage. They cannot be downloaded
until the scanner records `clean`. The worker callback accepts only final scan states.

Helpful votes are deliberately positive-only, one per answer and actor, and capped at five per
day. The domain stores votes but exposes no ranking, popularity sort, or leaderboard aggregate.

`tutorResponseSla` reports a transparent target of 12 weekday service hours. It is a reporting
metric—not a promise, a timer, or an escalation mechanism—and weekends do not consume the target.

## Persistence boundary

`DiscussionDatabase` is deliberately an interface. This phase does not include a database
migration (the task excludes `packages/db`), so production wiring must provide a repository that
implements this interface before HTTP mutation routes are enabled. The in-memory test adapter
shows the exact required behavior without creating an accidental unmoderated fallback store.
