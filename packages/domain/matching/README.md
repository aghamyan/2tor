# Matching

An administrator creates a `proposed` `tutor_student_assignments` row. The proposal does not
grant access. Only the proposed tutor can accept it, which transitions the row to `active` while
preserving its `startAt` and optional `endAt`.

Tutor authorization receives this row as `TutorAssignmentFact` and allows student access only if
`status === "active"` and `endAt` is absent or in the future. Ending an assignment atomically
sets `status` to `ended`, sets `endAt` to the ending instant, stores `endedReason`, and appends an
audit event with the acting staff member and reason. Either persisted field independently causes
authorization to deny, so access is revoked immediately.

Parents cannot assign tutors. A linked parent can create a pending tutor-change request, which is
returned by the staff-only matching queue. Matching notes are staff-only and attached to exactly
one request or assignment.
