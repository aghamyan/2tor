# Incident response runbook

**Operational status:** procedure documented; production paging and end-to-end escalation are not
yet proven. Public launch remains blocked.

This runbook covers child safety, privacy/security, account compromise, payments, malware uploads,
and availability/recovery. It does not replace advice from safeguarding professionals or counsel.

## Ownership and severity

The founder must assign people, not just inboxes, to these roles before launch:

| Role                     | Responsibility                                                            |
| ------------------------ | ------------------------------------------------------------------------- |
| Incident commander       | Owns severity, timeline, assignments, and closure                         |
| Safeguarding lead        | Owns child-safety triage and suspension decisions                         |
| Security/operations lead | Containment, evidence, credentials, infrastructure, recovery              |
| Privacy lead and counsel | Breach assessment, notifications, preservation and retention advice       |
| Communications lead      | Approved family, tutor, regulator, and public communications              |
| Payments owner           | Stripe coordination, webhook reconciliation, refunds and dispute handling |

| Severity    | Definition                                                                                                                                | Initial response target                         |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| P0 critical | Imminent child harm; active material breach; broad auth bypass; destructive compromise; unrecoverable service/data loss                   | Page immediately; acknowledge within 15 minutes |
| P1 high     | Credible safety concern without imminent harm; contained sensitive-data exposure; privileged-account compromise; material payment failure | Acknowledge within 30 minutes                   |
| P2 medium   | Limited security/privacy issue, malware quarantined, or degraded critical workflow with workaround                                        | Same business day                               |
| P3 low      | Minor operational issue, false positive, or control improvement                                                                           | Triage in the normal queue                      |

Child-safety reports default to P0 until a trained safeguarding lead downgrades them. Do not ask an
untrained responder to decide whether a child is safe.

## First 15 minutes

1. Acknowledge the report without promising an outcome. Create one incident ID and record UTC
   timestamps, reporter channel, affected accounts/resources, and the minimum necessary facts.
2. Assign an incident commander and, for any child-related report, the safeguarding lead.
3. Stop ongoing harm with the least destructive control: revoke sessions, suspend an account,
   disable a feature, quarantine an upload, or isolate traffic. Do not silently delete messages,
   files, audit records, or other evidence.
4. Preserve request IDs, audit-event IDs, message/conversation IDs, upload keys, authentication
   events, webhook event IDs, relevant logs, configuration version, and deployment revision.
   Restrict the evidence to authorized responders.
5. Establish a private response channel and a written decision log. Keep child and personal data
   out of broad chat channels and tickets.
6. Decide whether the incident is contained, what remains exposed, and the next update time.

## Reporting paths and current limitation

The support safety-ticket path creates a critical incident record, and can send an escalation to
`SUPPORT_SAFETY_ESCALATION_WEBHOOK_URL`. The communication abuse-report path records an abuse
report, but review found no demonstrated creation of the same incident/escalation record.
Production configuration and on-call receipt have not been proven.

Until those gaps are closed:

- every safety or abuse report must also be manually paged to the safeguarding lead;
- the responder must link the support ticket/abuse report to the incident ID;
- launch is **NO-GO** if the paging destination is unset, unmonitored, or not exercised in a drill.

## Child-safety playbook

1. Prevent further direct contact while preserving the parent-visible transcript and audit trail.
2. Suspend the relevant tutor/adult or freeze the conversation when credible risk outweighs
   continued access. Record who approved the action and why.
3. Preserve reports, messages, membership, files, lesson details, login activity, and moderation
   decisions. Do not conduct an amateur investigation or confront a suspected offender through the
   platform.
4. Notify the parent/guardian when safe and appropriate under the approved safeguarding policy.
5. A trained safeguarding lead decides whether emergency services, child-protection authorities,
   or other external parties must be contacted under applicable law and immediate-risk guidance.
6. Counsel decides legal notifications and evidence-retention requirements. Record the decision,
   including a decision not to notify.

## Security, privacy, and account compromise

1. Revoke affected sessions and rotate exposed credentials, API keys, webhook secrets, signing
   keys, and recovery codes. Preserve the old-key identifiers and timestamps without copying secret
   values into the incident record.
2. Block the exploit path and determine scope from server-side logs and append-only audit events.
3. Identify affected data categories, people, jurisdictions, earliest access, persistence, and
   exfiltration indicators.
4. Validate authorization boundaries after containment. A critical authorization bypass remains a
   release blocker.
5. Privacy lead/counsel determines notice recipients and deadlines. Do not invent a universal
   notification deadline.

## Payments and webhook incidents

1. Do not infer payment completion from a browser response. Reconcile against signed Stripe events
   and Stripe's authoritative state.
2. Preserve the Stripe event ID, signature-validation result, local audit-event ID, idempotency key,
   invoice/refund IDs, and request ID.
3. Pause affected financial writes if duplicate, out-of-order, or invalid-signature events are not
   safely handled.
4. Re-deliver only through the approved Stripe workflow and confirm replay did not duplicate the
   local transition or notification.
5. Large refunds and high-risk finance changes require fresh MFA and the configured approval
   controls.

## Upload or malware incident

1. Keep every non-clean object private and quarantined; revoke download access.
2. Preserve object key, uploader, MIME/signature result, hash, scan-provider result, and references.
3. Determine whether the file was ever marked clean or served. If so, treat it as a security
   incident and identify every accessor.
4. Do not release uploads until a real scanning provider has returned `clean`. The current review
   found quarantine mechanics but no proven scanner integration; see
   [SECURITY_REVIEW.md](./SECURITY_REVIEW.md).

## Availability and database recovery

1. Freeze risky writes and deployments, capture metrics/logs, and identify the last known-good
   point.
2. Choose fail-forward, rollback, or restore based on data integrity—not only uptime.
3. Follow [BACKUP_RESTORE.md](./BACKUP_RESTORE.md); restore into a fresh target and validate before
   switching traffic.
4. Record measured RPO and RTO and reconcile writes that occurred around the recovery point.

## Recovery and closure

- Validate the affected control, monitor for recurrence, and obtain incident-commander approval
  before restoring access.
- Give affected users only reviewed, accurate instructions; never expose another person's data.
- Complete a blameless post-incident review within five business days for P0/P1: impact, timeline,
  root cause, detection gap, control failures, decisions, remediation owner/due date, and test.
- Link remediations to [LAUNCH_GATES.md](./LAUNCH_GATES.md). A gate is not closed by a promise or
  code path alone; attach drill, deployment, or review evidence.

## Pre-launch drill

Run a synthetic safety report in the isolated environment and a production paging test with no
child data. Evidence must show: report submission, incident creation, notification receipt,
acknowledgement time, role handoff, suspension/containment rehearsal, evidence preservation, and
closure. Also exercise credential compromise, invalid/replayed Stripe webhook, quarantined upload,
and backup restore scenarios.

Founder responsibilities are to appoint the roles, fund/onboard safeguarding training, configure
and monitor the escalation channel, make the background-screening decision, and run the drills.
Counsel/safeguarding professionals own the jurisdiction-specific policy, reporting criteria,
retention, and notification review.
