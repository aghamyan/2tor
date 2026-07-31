# Launch gates — spec §22.4

**Assessment date:** 2026-07-29  
**Current decision:** **NO-GO**

Public launch is blocked by real control and evidence gaps. A gate is PASS only when the control is
implemented, its automated/manual evidence passes, and the accountable owner has signed it. A
document, planned task, or unverified production setting is not evidence.

Status meanings: **PASS** = evidenced for the stated scope; **CONDITIONAL** = implementation exists
but review/deployment proof is incomplete; **FAIL** = control or required evidence is missing or
failing; **OWNER** = non-code decision/evidence belongs to founder, counsel, or another named human.

## Go/no-go checklist

| Launch gate                                          | Status              | Evidence, gap, and closure requirement                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Accountable signoff                   |
| ---------------------------------------------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| Verifiable parental consent implemented and reviewed | CONDITIONAL         | Implementation and authorization tests exist in `apps/web/tests/consent`, and `apps/web/e2e/enrollment-and-learning.spec.ts` exercises signed-form evidence before activation. Legal/safeguarding review of method, policy version, evidence retention, revocation, and jurisdictional adequacy is not attached.                                                                                                                                                                                                                                                                                                | Founder + privacy counsel             |
| Privacy Policy and Terms reviewed                    | OWNER               | Public pages exist and are covered by the accessibility sweep, but repository presence is not legal approval. Attach dated counsel-approved documents, effective/version dates, jurisdiction/age scope, and change-notice procedure.                                                                                                                                                                                                                                                                                                                                                                            | Counsel + founder                     |
| Tutor code of conduct exists                         | OWNER / FAIL        | No approved code, tutor acknowledgement, enforcement owner, or versioned training artifact was evidenced. It must cover child-contact boundaries, monitored communications, lesson conduct, reporting, prohibited off-platform contact, suspension, and acknowledgement retention.                                                                                                                                                                                                                                                                                                                              | Safeguarding lead + counsel           |
| Safeguarding training exists                         | OWNER / FAIL        | No curriculum, qualified reviewer, completion roster, renewal interval, or failure/escalation process was evidenced. Strongly recommended background/criminal screening in spec §11.6 also needs a documented founder/counsel decision before public launch.                                                                                                                                                                                                                                                                                                                                                    | Founder + safeguarding lead + counsel |
| Incident reporting works                             | FAIL                | Support safety tickets can create an incident and optionally call a webhook, but abuse-report escalation and production delivery/acknowledgement are unproven. Complete the drill in [RUNBOOK_INCIDENT.md](./RUNBOOK_INCIDENT.md).                                                                                                                                                                                                                                                                                                                                                                              | Safeguarding lead + operations        |
| Backup restored in a test                            | PASS (test scope)   | A real custom-format PostgreSQL dump was restored into a fresh database on 2026-07-29; 123 tables, all per-table row counts, a sentinel, and normalized schema matched. See [BACKUP_RESTORE.md](./BACKUP_RESTORE.md). Production scheduling/encryption/off-server/retention evidence is still required operationally.                                                                                                                                                                                                                                                                                           | Infrastructure owner                  |
| No critical authorization vulnerability remains      | CONDITIONAL         | Review found no critical authz bypass, and broad RBAC/relationship tests exist. Missing explicit CSRF enforcement and incomplete route-by-route adversarial coverage prevent final signoff. See [SECURITY_REVIEW.md](./SECURITY_REVIEW.md).                                                                                                                                                                                                                                                                                                                                                                     | Security reviewer                     |
| Admin MFA mandatory                                  | CONDITIONAL         | Required-role login and fresh step-up controls exist with tests under `apps/web/tests/auth`. Attach production evidence that every admin is enrolled and an admin login without setup/code is denied; remove/break-glass exceptions must be approved and audited.                                                                                                                                                                                                                                                                                                                                               | Security + operations                 |
| Payment webhooks idempotent                          | PASS (code)         | Signature validation and deterministic event claiming are implemented in `packages/domain/payments`; payment E2E coverage exists. Before GO, attach one isolated Stripe replay showing the second delivery makes no duplicate transition/notification.                                                                                                                                                                                                                                                                                                                                                          | Payments owner                        |
| Child-adult communications policy enforced           | PASS (code)         | Authorization explicitly denies private adult-child messaging; communication service and E2E safety tests exercise monitored conversations. Human safeguarding review of the policy, moderation staffing, and report drill remains required.                                                                                                                                                                                                                                                                                                                                                                    | Safeguarding lead                     |
| WCAG 2.2 AA accessibility reviewed                   | FAIL                | The new automated sweep covers 18 public/core pages on desktop and mobile, plus keyboard focus and 200%-equivalent reflow. Public pages, keyboard, and reflow passed in the 2026-07-29 desktop run, but only 8/20 desktop tests passed overall. Serious failures include missing document titles and tutor-dashboard contrast; transient Redis initialization and a duplicate `main` landmark also surfaced. Production routing itself loops. Rerun `.github/workflows/accessibility.yml` after fixes, attach a passing report, and complete manual keyboard, screen-reader, zoom, mobile, and Armenian review. | Accessibility reviewer + product      |
| Tutor-verification claims accurate                   | OWNER / CONDITIONAL | Product data can represent verification states, but claims must match the checks actually completed. Publish no “verified,” screening, credential, curriculum, or safeguarding claim without an evidence definition, expiry/recheck process, exception handling, and claims/counsel review. Record the background-screening decision explicitly.                                                                                                                                                                                                                                                                | Founder + counsel + safeguarding lead |
| One full month of private beta completed             | OWNER / FAIL        | No dated start/end, cohort, incident/support log, retention/payment reconciliation, safety drill, or exit review was supplied. Attach at least one complete month and a signed findings/remediation review.                                                                                                                                                                                                                                                                                                                                                                                                     | Founder + operations                  |

## Performance/load gate

Spec §13.2 expects 50 concurrent active users; the required 5x launch test is therefore **250
concurrent users**. [`load/launch-5x.js`](../load/launch-5x.js) allocates them as:

| Scenario                       |     VUs |                  §13.1 threshold |
| ------------------------------ | ------: | -------------------------------: |
| Unauthenticated marketing HTML |      50 |                     p95 < 800 ms |
| Authenticated dashboard shell  |     100 |                   p95 < 2,000 ms |
| Common authenticated API       |      75 |                     p95 < 500 ms |
| Message acknowledgement        |      25 |                     p95 < 500 ms |
| **Total**                      | **250** | checks > 99%; HTTP failures < 1% |

**Status: FAIL / NOT EXECUTED AT 5x.** There is no approved production-shaped isolated target or
session evidence in this workspace, and the checked-in public/localized routing currently loops.
Running 250 VUs against a development server would create misleading p95s and unsafe fixture
writes. Consequently no 5x p95 is claimed:

| Metric                  |     Target | Recorded 5x p95 | Result                             |
| ----------------------- | ---------: | --------------: | ---------------------------------- |
| Marketing HTML          |   < 800 ms |    Not measured | FAIL — routing/target blocker      |
| Dashboard shell         | < 2,000 ms |    Not measured | FAIL — routing/target blocker      |
| Common API              |   < 500 ms |    Not measured | FAIL — target/auth evidence absent |
| Message acknowledgement |   < 500 ms |    Not measured | FAIL — target/auth fixture absent  |

Closure: fix public/localized routing, deploy a production-shaped isolated environment with
representative data, supply dedicated parent/tutor sessions and a monitored conversation fixture,
run the manual `load-smoke.yml` launch profile, retain `summary.json`, and record actual p95 values
in this table. A miss remains NO-GO unless a time-bounded remediation, owner, rerun date, and
explicit risk acceptance are approved; child-safety or authorization failures cannot be waived.
Instructions and safety controls are in [`load/README.md`](../load/README.md).

## Additional hardening gates

| Gate                            | Status      | Evidence / closure                                                                                                                                                   |
| ------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Production dependency review    | FAIL        | 2026-07-29 audit: 0 critical, 3 high, 1 moderate. Close SEC-03 in [SECURITY_REVIEW.md](./SECURITY_REVIEW.md).                                                        |
| Malware scanning                | FAIL        | Quarantine mechanics exist; a real scanner, complete callbacks, stale-pending alert, and malicious-file drill do not.                                                |
| Audit append-only               | CONDITIONAL | Database triggers rejected direct UPDATE and DELETE. Existing integration assertion must be repaired and green in CI.                                                |
| Production backup operations    | CONDITIONAL | Test restore passed; attach encrypted schedule, off-server copy, retention, monitoring, and production-derived restore proof.                                        |
| Public application availability | PASS (code) | Locale routing, public pages, authenticated Redis sessions, and database-backed UI paths pass 8 E2E and 40 desktop/mobile accessibility cases in the isolated stack. |

## Required non-code decisions and evidence

These cannot be completed by an engineering artifact:

- **Founder:** appoint safeguarding/on-call owners; choose and fund background screening; ensure
  tutor verification claims match reality; complete the private-beta month; approve operational
  staffing and risk acceptance.
- **Counsel/privacy reviewer:** approve parental-consent method/evidence, Privacy Policy, Terms,
  tutor code, incident/reporting policy, retention and notification decisions, and public claims.
- **Safeguarding professional:** approve training, tutor boundaries, moderation/escalation,
  suspension, parent notification, and emergency-response procedures.
- **Independent security/accessibility reviewers:** complete adversarial authorization/CSRF review
  and manual WCAG 2.2 AA review after automated blockers are fixed.

## Final release record

Do not change **NO-GO** to **GO** until every FAIL is closed, every CONDITIONAL has its required
deployment/review evidence, every OWNER item has a named signer and date, the 250-user report meets
the thresholds, and the accessibility workflow is green.

Final decision: `GO / NO-GO`  
Release revision/environment:  
Founder/date:  
Safeguarding lead/date:  
Counsel/privacy/date:  
Security/date:  
Accessibility/date:  
Operations/payments/date:
