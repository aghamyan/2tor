# Assessments

This slice supports versioned tutor-authored assessments, question pools, deterministic
per-attempt question/choice/value randomization, timed and fullscreen modes, answer history,
and tutor-written diagnostic reports.

## Signals are not proof

`assessment_events` is an append-only activity log for tutor review. It records lifecycle events,
answer timestamps and changes, focus or tab loss, fullscreen exits, connectivity interruptions,
and detectable copy/paste attempts. These entries are context signals only:

- no event, count, or pattern creates an accusation or verdict;
- a tab switch is recorded exactly like the other review signals and does not set a status flag;
- tutors review signals alongside answers and can follow up with the student;
- students see the collection notice before an attempt starts and accept an honor statement before
  submitting.

Downstream analytics, notifications, and reviewer interfaces must preserve this contract. They may
summarize event counts, but must not convert them into a guilt label, risk verdict, or automated
disciplinary action.

**One narrow, disclosed exception:** a version's `settings.integrityPolicy` (`AssessmentIntegrityPolicy`
in `models.ts`) lets a tutor opt a specific assessment into `"warn"` (client-shown notice) or
`"auto_submit"` (the server ends the attempt via `recordAssessmentSignals` in services.ts once a
tutor-set count of "left the exam" events — `INTEGRITY_VIOLATION_EVENT_TYPES`: tab switch, focus
loss, fullscreen exit, browser minimize — is reached). This is not the suspicion score making a
call; it is an explicit, author-configured setting, disclosed to the student on that assessment's
entry screen before they start (`entry.notice.integrityPolicy`), with no verdict or guilt label
attached — the attempt is simply closed (`abandoned`), same as a timed-out attempt, for a tutor to
review like any other. `"log_only"` is the default, so every assessment that doesn't opt in behaves
exactly as before: nothing here ever gates a submission on its own.

## Camera boundary

A version may request a camera only when it names a policy version. Starting that version requires
both an active consent record for `assessment_camera:<policyVersion>` and an explicit acknowledgment
in the start request. By default this slice contains no recording, face identification, or emotion
analysis; the one narrow, disclosed, opt-in exception (`camera.evidenceCaptureEnabled`) is
documented below under "Evidence photos" and never includes identification or emotion analysis
either.

A version may additionally opt into `camera.headTrackingEnabled` (requires `camera.required`). When
on, the student's browser runs on-device face presence/count/gaze detection
(`@mediapipe/tasks-vision`, `components/assessments/proctoring/face-tracking-service.ts`) to emit
`face_missing`, `face_returned`, `multiple_faces`, `gaze_away`, and a heuristic
`external_device_suspected` signal. This is presence, count, and coarse gaze angle only — not face
*identification* (no template is created or matched against an identity) and not emotion analysis,
so it stays inside the boundary above. Every frame is processed locally in WASM; no image or video
frame is ever sent to the server, and nothing is recorded or stored — only the derived signal
(a short-lived boolean/count/angle) reaches `recordAssessmentSignal` — **unless** the version also
opts into `camera.evidenceCaptureEnabled`, the one documented exception below. Disabled by default;
an author opts in per version, matching CONVENTIONS' data-minimization rule that biometric-adjacent
signals require an explicit, justified opt-in.

A version may additionally opt into `camera.objectDetectionEnabled` (requires
`camera.headTrackingEnabled`). When on, the student's browser runs a second, independent on-device
model — MediaPipe's `ObjectDetector` (COCO-trained, `components/assessments/proctoring/
object-detection-service.ts`), not the face landmarker — against the same video element, restricted
to a narrow category allowlist (`cell phone`, `laptop`, `book`, `remote`; COCO's `keyboard`/`mouse`
are deliberately excluded, since a student's own exam peripherals would false-positive constantly).
A sustained detection (not a single frame, to rule out a misclassified hand or reflection) emits
`phone_detected` for a phone or `unusual_item_detected` (carrying the specific category in
`metadata.category`) for the others. This is presence/category detection only — not identification
of a specific device — so it stays inside the boundary above. The model asset
(`efficientdet_lite0.tflite`) is self-hosted the same way as the face landmarker's (see
`scripts/prepare-mediapipe-assets.mjs`), and every frame is processed locally in WASM; only the
derived category/score signal reaches `recordAssessmentSignal`.

The same `camera.headTrackingEnabled` opt-in also unlocks eyes-closed detection, via the face
landmarker's own blendshape output (`eyeBlinkLeft`/`eyeBlinkRight`) rather than a separate model —
it isn't a distinct capability, just another signal read off the same face mesh. A sustained
(several-second), both-eyes closure emits `eyes_closed`. Because a normal blink, a heavily angled
face, or a partial occlusion can also spike these blendshapes, and this signal hasn't been tuned
against real footage the way the spec's own original signals were, `eyes_closed` carries **zero**
weight in `DEFAULT_SUSPICION_WEIGHTS` (`suspicion.ts`) — it is still logged, still shown to the
tutor, still eligible for evidence capture below, but never moves the suspicion score. This is the
"signals are not proof" contract applied deliberately conservatively to a signal most likely to
false-positive on an honest, thinking student.

A repeated down-and-to-a-side glance pattern (as opposed to a centered, sustained downward tilt,
which is normal handwriting posture and stays exempt) separately raises `external_device_suspected`
for tutor review — a heuristic that predates object detection and stays in place alongside it, since
it can catch a device object detection's category allowlist doesn't cover.

### Evidence photos (opt-in exception to "no frame ever leaves the browser")

A version may additionally opt into `camera.evidenceCaptureEnabled` (requires
`camera.headTrackingEnabled`). When on, the student's browser captures a single downscaled JPEG
frame from the same on-device video element face tracking already uses, but only when one of a
narrow, fixed set of signals fires (`EVIDENCE_CAPTURE_EVENT_TYPES` in schemas.ts:
`multiple_faces`, `face_missing`, `external_device_suspected`, `phone_detected`,
`unusual_item_detected`, `eyes_closed`) — a client-side, per-type cooldown (tighter for
`phone_detected` than the calmer object/eyes-closed signals, so a lower-priority type can't crowd
out phone evidence) and a server-enforced per-attempt cap bound how often. That photo is uploaded to
private object storage
(`packages/domain/assessments/storage.ts`, the same S3-backed pattern
`packages/domain/assignments/storage.ts` already uses) and is reachable only through a short-TTL,
HMAC-signed download URL minted for the assigned tutor or staff — the same authorization
`getAssessmentAttemptReview` already enforces. No other route, including the student's own, can
read it back.

This is deliberately **not** a new database table: `packages/db` schema changes are outside this
module's file scope (see "Existing-schema compatibility" below), so an evidence capture is written
as its own `assessment_events` row with `eventType: "evidence_captured"` — never the triggering
type — and the file key lives in that row's `metadata`. Giving it a dedicated, non-scored type is
load-bearing, not cosmetic: `computeSuspicionSummary` and the review stats bucket purely by
`eventType`, so reusing the triggering type would silently double-count every photographed
violation. `getAssessmentAttemptReview`'s `evidence` list is a pure derivation over the same event
log, exactly like the suspicion score.

Every assessment that doesn't opt in behaves exactly as documented above: no frame, still or
video, ever leaves the browser. When a version does opt in, the entry-screen collection notice
discloses it before the student starts (`entry.notice.evidenceCapture`). Submitting, or an
integrity policy auto-closing, a camera-required attempt notifies the assigned tutor(s)
(`packages/notifications`, reusing the `progress_update` type) with a link to the review page —
never the photos themselves as an attachment, since the review page already gates access the same
way. Retention/deletion policy and virus scanning are not yet automated for these photos — treat
that the same way Sentinel's own README treats its evidence capture: "Establish consent, retention
limits, access controls, and deletion procedures before using this prototype with real candidates."

## Proctoring signals and the suspicion score

Beyond the original focus/fullscreen/tab/copy/paste signals, this slice also detects (all
client-side, all logged through the same `assessment_events` pipeline): browser minimizing,
clipboard cut, select-all/print/save-page/view-source keyboard shortcuts, the right-click context
menu, dragging content out of the page, a devtools keyboard shortcut (not devtools actually being
open — that isn't reliably detectable), camera connect/disconnect, and the camera signals above.
`packages/domain/assessments/suspicion.ts` exposes `computeSuspicionSummary`, a pure function that
turns the event log into a weighted score, a severity band (`low`/`medium`/`high`), and per-attempt
stats (face-visible %, tab-switch count, fullscreen exits, clipboard attempts, camera disconnects).
It is **derived at read time on every call, never stored** — there is no suspicion-score column.
The score inherits the "signals are not proof" contract above word for word: it is a review aid
shown to the tutor (`components/assessments/diagnostic-review.tsx`), it is shown to the student as a
non-blocking banner past a threshold (never a pause or fail), and it never gates `submitAssessmentAttempt`.

New canonical event types (see `AssessmentEventType` in `models.ts`) did not require a database
migration: they follow the existing-schema-compatibility pattern below exactly — each new type maps
to the nearest existing Postgres enum bucket in `drizzle-database.ts`'s `rawEventType`, and the true
type travels in `metadata[EVENT_TYPE_KEY]`. `packages/domain/assessments/head-pose.ts` is the pure
math (rotation-matrix → yaw/pitch/roll) the face tracker uses to decide "looking away"; it has no
DOM or MediaPipe dependency so it is unit-tested directly.

## Convention exception: `@mediapipe/tasks-vision`

CONVENTIONS.md bars a module from touching any `package.json`. This slice makes one deliberate,
narrow exception: `@mediapipe/tasks-vision` (declared in the shared `pnpm-workspace.yaml` catalog,
referenced only from `apps/web/package.json`) is the client-side face-landmark model the spec asks
for by name. It is dynamically imported only inside `face-tracking-service.ts`, so it never loads
unless a version has both `camera.required` and `camera.headTrackingEnabled` set. The same package
also exports `ObjectDetector`, used by `object-detection-service.ts` for phone/unusual-item
detection — a second model on the same already-exceptioned dependency, not a new one; it is
dynamically imported only inside that module, so it never loads unless a version additionally has
`camera.objectDetectionEnabled` set. No other module dependency was added or changed.

## Keyboard/clipboard/fullscreen enforcement is best-effort

`components/assessments/proctoring/{shortcut,clipboard,focus}-guard.ts` intercept common shortcuts,
clipboard events, the context menu, drag-out, and fullscreen exit. These discourage and log; they do
not guarantee prevention — a browser or OS can always route around `preventDefault`, and devtools
being *open* is not reliably detectable (only the shortcut *attempt* is). Every guard degrades
gracefully: a version without `fullscreenRequired` runs only the always-on focus/tab/fullscreen/
offline signals from the original slice, and a browser that fails to load the face-tracking model
falls back to camera-presence-only monitoring rather than blocking the attempt.

## Diagnostic report release

The report is written by the assigned tutor. It remains unavailable to the linked parent until the
tutor records that the consultation occurred and deliberately releases the report.

## Existing-schema compatibility

The current database schema predates several Phase-2 settings. The Drizzle adapter stores version
settings and the report release lifecycle in versioned JSON envelopes inside their existing text
fields, and stores the canonical event type in event metadata when the database enum has no direct
value. Service callers always receive the canonical domain model. Replace these envelopes with
dedicated columns in a future database-owned migration without changing the service contract.
