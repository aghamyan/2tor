# Launch load gate

`launch-5x.js` maps the §13.2 expectation of 50 concurrent active users to exactly 250 virtual
users at the launch profile:

| Scenario                       |     VUs | §13.1 threshold               |
| ------------------------------ | ------: | ----------------------------- |
| Unauthenticated marketing HTML |      50 | p95 < 800 ms                  |
| Parent dashboard shell         |     100 | p95 < 2,000 ms                |
| Common authenticated API read  |      75 | p95 < 500 ms                  |
| Message-send acknowledgment    |      25 | p95 < 500 ms                  |
| **Total**                      | **250** | error/check failure rate < 1% |

The steady phase defaults to five minutes after a one-minute ramp and is followed by a one-minute
ramp down. This is a capacity gate, not a soak test. Zoom transports lesson video, so the script
does not generate video traffic; the 250 active sessions are stricter than the 5× lesson-count
assumption at the application boundary.

Run only against an isolated, production-shaped test environment. Two test accounts and a
parent-visible conversation are required. Prefer supplying `MESSAGE_CONVERSATION_ID`. If it is
absent, `ALLOW_FIXTURE_WRITE=true` lets the setup phase create one monitored parent + student +
tutor conversation. That fixture path intentionally cannot run without an explicit opt-in.

```sh
BASE_URL=https://load.example.test \
PARENT_SESSION_COOKIE='session_id=redacted' \
TUTOR_SESSION_COOKIE='session_id=redacted' \
MESSAGE_CONVERSATION_ID='conversation-id' \
k6 run --summary-export load-summary.json load/launch-5x.js
```

For wiring validation only, set `LOAD_PROFILE=smoke`; it runs four VUs and retains the same
thresholds. Smoke output is not §13.2 launch evidence. Store the full test's raw summary and the
environment/deployment identifiers with the dated result in `docs/LAUNCH_GATES.md`. Never commit
cookies or tokens.
