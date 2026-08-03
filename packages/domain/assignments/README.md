# Assignments and submission uploads

Assignments are tutor-authored work for one student. The domain service checks that a tutor is
actively assigned to that student before creation, viewing a submission, or grading it. Students
can only submit to their own student profile. A linked parent has read-only access (assignment,
submission, grade, and files) but can never create, submit, or grade — see
`requireViewerRelationship` vs. `requireAssignedTutor`/`requireStudentOwner` in `services.ts`. Staff
retain full operational access.

## UI module (`apps/web/app/(app)/assignments`, `apps/web/components/assignments`)

List, detail, creation, submission, file, and grading views for parent/student/tutor/administrator/
super_administrator, all built against the domain services above. Reads (`queries.ts`) call
`listAssignmentsForActor`/`getAssignmentForActor`/etc. directly from Server Components; writes
(`actions.ts`) are Next.js Server Actions calling the same domain services — mirroring the
`families` and `scheduling` modules' convention, not a REST round-trip to `apps/web/app/api/assignments`
(that surface remains for external/API consumers and is exercised by its own route-level tests).

`apps/web/app/(app)/assignments/authorization.ts` adds a defense-in-depth `@app/auth` `authorize()`
call at the web boundary (`academic.view_record` for reads, `academic.edit_learning_plan` for
tutor-only writes) alongside the domain layer's own relationship checks — the `@app/auth` action
catalog has no assignment-specific entries, so this is the closest semantic fit, following the same
proxy-mapping pattern already established in `families/authorization.ts`.

### Cross-module query contract consumed

This module owns no cross-module _write_ access — it never calls another module's services or
domain functions — but it reads three tables that other modules own, via `@app/db`'s shared schema
(the sanctioned way to read cross-module data in this codebase; see `isTutorAssignedToStudent`,
which already did this before this UI slice was built):

- `student_profiles` / `subjects` (owned by `academics`/`families`) — display names in list/detail
  views and in the tutor's "create assignment" student picker.
- `tutor_student_assignments` / `tutor_profiles` (owned by `matching`) — the same active-relationship
  fact used both for tutor list-scoping and for the `@app/auth` authorization gate's
  `tutorAssignment` fact.
- `parent_profiles` / `parent_student_links` (owned by `families`) — parent list-scoping and the
  `parentLinked` fact, mirroring `families`' own `parentLinkedToStudent` pattern.

No other module reads this module's tables directly; `apps/web/app/api/assignments/**` is the only
sanctioned integration point this module exposes.

## Upload security pattern

This is the shared pattern for Assignments, Projects, and Resources:

1. The API reads the bytes server-side and validates an explicit MIME allowlist, declared size,
   and type-specific magic bytes. Limits are image 15 MB, document 25 MB, audio 50 MB, video
   250 MB, and ZIP/code archive 20 MB. ZIP containers are never extracted by the application.
2. JPEG APP/COM metadata and all PNG ancillary metadata chunks are stripped before storage.
3. The sanitized object is put under a non-public S3 key with `quarantine=pending`; its database
   row starts as `pending` scan status.
4. The scanner reports only `clean`, `infected`, or `error` through the worker callback. Only a
   `clean` row can produce a short-lived, HMAC-signed, user-bound download URL. The download route
   rechecks the session, signature, relationship authorization, and scan status before streaming
   the private object.

Do not use direct S3 URLs, trust browser `Content-Type`, or expose a file while its scan is pending.
