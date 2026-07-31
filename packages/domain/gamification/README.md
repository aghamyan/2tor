# Gamification

This slice owns a child’s private, append-only points ledger, levels, badges, streaks, grace
periods, and opt-in seasonal challenges. Points have **no monetary or purchase value**. It has no
global child leaderboard and exposes no rank or cross-child comparison query.

## Record a point event

Other trusted domain modules call `recordPointEvent()` only after their own source record has been
validated and committed. The caller chooses a fixed event type and stable source ID; it cannot
choose a point amount.

```ts
await recordPointEvent(gamificationDatabase, {
  studentProfileId,
  type: "improvement_over_prior_attempt",
  referenceId: assessmentAttemptId,
  occurredAt: new Date(),
  createdByUserId: tutorUserId,
});
```

Supported types are `on_time_assignment`, `improvement_over_prior_attempt`,
`thoughtful_question`, `milestone_completed`, `approved_peer_help`, `project_completed`, and
`attendance`. The service maps those types to the fixed policy, writes the ledger, updates the
balance/level, and awards applicable badges. Repeating the same `(student, type, referenceId)` is
a no-op.

For an approved illness, travel, or other approved absence, call
`recordStreakGracePeriod()` with the missed UTC learning date. It writes a zero-point ledger
context record; it neither awards a reward nor resets the streak. The next qualifying attendance
or assignment event bridges that marked day.

## Parent controls and challenges

`setCompetitionPreference()` is parent-only and relationship-scoped. Competition is off by
default; every linked parent must opt in before the optional community-challenge UI appears. The
only challenge projection contains the child’s own progress—never a rank or other children’s
scores. The public API intentionally has no endpoint for recording points: source modules use the
server-side entry point above.
