# Families domain

This slice owns parent profiles, parent-created student accounts, parent↔student links, interests,
learning preferences, and parent-led corrections.

## Invariants

- `createStudentUnderParent()` is the only public student creation service. It rejects a missing
  actor and every actor without the `parent` role.
- Student account, inactive profile, primary parent link, student role grant, and link audit event
  are written in one transaction. Activation is deliberately not performed here.
- Minor students cannot lose their final parent link.
- Parent reads are relationship-scoped. A missing link is returned as `STUDENT_NOT_FOUND` so the
  API does not reveal whether an unrelated student id exists.
- Birth information is month/year or an age band. The input schemas have no exact DOB or address
  fields and are strict at JSON boundaries.
- Link, unlink, parent/student corrections, interest changes, and preference changes append to
  `audit_events`.

## Consent hand-off

`familyReadyForActivation(database, studentId)` reports only structural family readiness. D2 calls
it and then applies consent rules. It intentionally does not inspect, create, or mutate consent.

## Web boundary

Web actions and routes authenticate the opaque session through `familyRequestContext()` and call
`@app/auth` before invoking these services. Services repeat the parent/link checks as defense in
depth.
