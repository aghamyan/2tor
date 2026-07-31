# Projects and portfolios

Projects are individual or group learning records with explicit members, updates, protected
evidence files, and project-scoped rubrics. Tutors may create or supervise only projects whose
members they are assigned to; students can access only projects where they are members.

## Project uploads (D7 shared security pattern)

Project uploads use the same security boundary as assignment uploads:

1. The API receives bytes server-side and checks an explicit MIME allowlist, declared size, and
   format magic bytes. Image/document/audio/video/archive limits match Assignments. ZIP containers
   are never extracted.
2. JPEG APP/COM and PNG ancillary metadata are removed before storage.
3. The sanitized object is written under a non-public `projects/...` key with
   `quarantine=pending`; the database scan state also begins as `pending`.
4. The worker accepts only `clean`, `infected`, or `error`. A clean scan is required before the
   application issues a 60-second, HMAC-signed, user-bound URL. The download route checks the
   session, signature, relationship authorization, and scan state again before streaming.

There are no direct object-store URLs, and neither pending nor failed scans can be downloaded.

## Portfolio privacy and sharing

Portfolio items are private by default. `approvePortfolioSharing` is the sole public-sharing path:
it first writes a `portfolio_sharing_consents` record for a parent linked to the student, then sets
visibility to `public` in the same transaction. The public reader independently requires both
public visibility and a non-revoked consent record, so a direct visibility mutation or revoked
consent never exposes an item.

The public representation contains only the item title, description, and optional pre-public
external link. It excludes the student profile id, full name, photo, and private project or
assignment file keys. Students can assemble an item from a project reference or a public
assignment-evidence reference; private assignment/project uploads remain downloadable only through
their respective protected routes.
