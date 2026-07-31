# Support and incident workflow

This slice owns customer-support tickets, public/internal comments, incident actions, queue ordering,
SLA targets, and the safety-report path. It uses the existing `support_tickets`,
`support_comments`, `incidents`, and `incident_actions` tables. Category and SLA fields are kept
in a versioned envelope inside the existing ticket description column until an operations migration
adds first-class columns; callers always receive the clean description, never the envelope.

## Safety escalation integration

Safety is always `urgent`, always sorts before every other ticket, creates a `critical` incident,
and records the initial incident action atomically. Other modules (for example `abuse_reports`)
must call `createSafetyReport`, not create an incident directly:

```ts
await createSafetyReport(
  supportDatabase,
  actor,
  {
    subject: "Reported message",
    description: reason,
    urgency: "standard",
    sensitiveChange: null,
    source: { type: "abuse_report", id: report.id },
  },
  {
    escalate: async ({ ticket, incident }) =>
      onCall.notify({ ticketId: ticket.id, incidentId: incident.id }),
  },
);
```

The hook is called after the ticket/incident transaction succeeds, so an on-call adapter never
observes an incident that was rolled back. It should page the designated safeguarding responder;
it must be idempotent on `incident.id`. A hook failure is returned to the caller so the source
module can retry its delivery rather than silently dropping an escalation.

The web ticket API uses this same hook when `SUPPORT_SAFETY_ESCALATION_WEBHOOK_URL` is configured,
sending a JSON payload with an `Idempotency-Key` header equal to the incident ID. Deployments must
configure that endpoint to reach the safeguarding on-call system before enabling public reporting.

## SLA and sensitive recovery controls

Urgent tickets, including `lesson_starting_now`, receive a 15-minute in-support-hours target.
Ordinary tickets receive one business support day (12 published support-hours). The five-minute
`support.sla-breach-alert` worker emits an operational alert once and records its dedupe timestamp.

Account tickets requesting billing or parent-relationship recovery require MFA step-up freshness
(15 minutes). Before any family module changes parent ownership, it must call
`documentParentOwnershipReview` against the corresponding `parent_relationship` ticket; this
writes an internal review record and itself requires fresh step-up verification. The support slice
does not expose any direct parent-ownership mutation.
