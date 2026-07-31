# Assignments and submission uploads

Assignments are tutor-authored work for one student. The domain service checks that a tutor is
actively assigned to that student before creation, viewing a submission, or grading it. Students
can only submit to their own student profile. Staff retain operational access.

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
