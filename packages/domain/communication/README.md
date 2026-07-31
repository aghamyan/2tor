# Communication domain

This slice owns parent-inclusive conversations, append-only messages, attachments, read receipts,
staff access logging, abuse reports, realtime delivery, and ordinary-message retention.

## Non-negotiable invariant

A conversation with a student member must also have an active parent/guardian member. In
particular, every one-adult + one-child pairing (including parent + child alone) is impossible to
create; a child-visible conversation needs the parent plus at least one additional participant.
The service verifies
each requested member role against the account's live roles, checks the parent-inclusive
composition, and then runs the communication authorization adapter. The adapter derives
`isPrivateAdultChildChannel` from persisted members before delegating to `@app/auth`; malformed
legacy conversations are denied on read and send as well.

There is no tutor/student message-delete path. Messages are append-only. A participant reports
unsafe content, and staff may apply an audited redaction that preserves the row and its history.

## Staff access

Administrators and super-administrators must provide a 10–500 character operational or safety
reason before message bodies or attachments are fetched. `getConversationForActor` writes both an
`admin_access_reasons` row and an append-only `audit_events` row in the same transaction, before
querying messages. Opening an SSE stream performs this gate once for that stream.

## Attachments and retention

Attachments reuse the platform upload policy: server-side byte/size/signature validation, image
metadata removal, private quarantine storage, malware-scan status, and short-lived actor-bound
download URLs. Pending, infected, or errored files cannot be downloaded.

`listOrdinaryMessagesEligibleForRetention` exposes the two-year-after-account-inactivity query.
The weekly worker removes private attachment objects before eligible rows. Messages targeted by an
abuse report or linked safety incident are excluded, so safety/incident evidence and records are
never deleted by ordinary retention.
