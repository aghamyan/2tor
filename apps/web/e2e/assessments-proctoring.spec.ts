import { expect, expectJson, sessionIds, test } from "./fixtures/actors";

interface DataEnvelope<T> {
  data: T;
  requestId: string;
}

interface CreatedAssessment {
  assessment: { id: string; status: string };
}

interface StartedAttempt {
  attempt: { id: string };
}

interface AttemptReview {
  eventCounts: Record<string, number>;
}

/**
 * Covers the browser-enforceable proctoring guards (spec §4-10) end to end: fullscreen-required
 * "exam mode" locks the context menu and clipboard events, keyboard shortcuts are intercepted,
 * and every intercepted attempt lands in the attempt's own review log — never silently dropped,
 * never auto-failing the student. Camera/face-tracking is intentionally out of scope here:
 * exercising it needs `--use-fake-device-for-media-stream` on the browser launch, which belongs
 * in a project-level Playwright config, not the shared root `playwright.config.ts` every other
 * module's specs run under (see packages/domain/assessments/README.md "Convention exception").
 */
test("exam mode blocks the context menu and clipboard, intercepts shortcuts, and logs every attempt", async ({
  actors,
  page,
  baseURL,
}) => {
  if (!baseURL) throw new Error("Playwright baseURL is required.");
  const created = await expectJson<DataEnvelope<CreatedAssessment>>(
    await actors.tutor.post("/api/assessments", {
      data: {
        subjectId: "subj_math",
        title: "E2E proctoring check",
        description: "Fullscreen-locked practice for guard coverage.",
        type: "quiz",
        status: "published",
        version: {
          changeSummary: "Initial",
          durationSeconds: 1_800,
          fullscreenRequired: true,
          randomizeQuestionOrder: false,
          camera: { required: false, policyVersion: null, headTrackingEnabled: false },
          questions: [
            {
              type: "short_answer",
              prompt: "Name one prime number.",
              choices: null,
              correctAnswer: null,
              points: 1,
              poolId: null,
              randomizeOptions: false,
              randomValues: [],
            },
          ],
        },
      },
    }),
    201,
  );
  const assessmentId = created.data.assessment.id;

  await page.context().addCookies([
    { name: "session_id", value: sessionIds.student, url: baseURL },
  ]);

  await page.goto(`/assessments/${assessmentId}`);

  const startResponse = page.waitForResponse(
    (response) => response.url().includes(`/api/assessments/${assessmentId}/attempts`) && response.request().method() === "POST",
  );
  // Starting the attempt opens the exam in a new tab (`window.open` from AssessmentEntry) — the
  // original tab only ever shows a "opened in a new tab" confirmation after this.
  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: /begin assessment/i }).click();
  const started = (await (await startResponse).json()) as DataEnvelope<StartedAttempt>;
  const attemptId = started.data.attempt.id;
  const examPage = await popupPromise;
  await examPage.waitForLoadState();

  // No camera required in this fixture, so the exam tab's "ready" screen only needs the
  // fullscreen-gated "Begin exam" click before the guarded question view renders.
  await examPage.getByRole("button", { name: /begin exam/i }).click();
  await expect(examPage.getByRole("heading", { name: "E2E proctoring check" })).toBeVisible();
  // The heading paints as soon as ExamRunner's JSX commits; the clipboard/shortcut guards install
  // in that same component's useEffect, which React runs asynchronously just after — give it a
  // moment to settle before probing for guard behavior below.
  await examPage.waitForTimeout(300);

  // Right-click is intercepted — the browser's native context menu never opens.
  const contextMenuPrevented = await examPage.evaluate(() => {
    // The app shell renders its own <main id="app-shell-content"> around every routed page, so
    // the assessment runner's own <main> is the innermost (last) one in document order, not the
    // only one — targeting the outer shell main would dispatch the event outside the guarded
    // container entirely, since events only bubble up to ancestors.
    const mains = document.querySelectorAll("main");
    const target = mains[mains.length - 1] ?? document.body;
    const menuEvent = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
    target.dispatchEvent(menuEvent);
    return menuEvent.defaultPrevented;
  });
  expect(contextMenuPrevented).toBe(true);

  // A paste into the page is blocked at the clipboard event itself, not just logged afterward.
  const pastePrevented = await examPage.evaluate(() => {
    // The app shell renders its own <main id="app-shell-content"> around every routed page, so
    // the assessment runner's own <main> is the innermost (last) one in document order, not the
    // only one — targeting the outer shell main would dispatch the event outside the guarded
    // container entirely, since events only bubble up to ancestors.
    const mains = document.querySelectorAll("main");
    const target = mains[mains.length - 1] ?? document.body;
    const pasteEvent = new ClipboardEvent("paste", { bubbles: true, cancelable: true });
    target.dispatchEvent(pasteEvent);
    return pasteEvent.defaultPrevented;
  });
  expect(pastePrevented).toBe(true);

  // The signal bus batches and flushes every ~2s from a background popup tab, which some browsers
  // throttle — wait for the actual flush response rather than a fixed delay, so this isn't flaky
  // under that throttling and doesn't wait longer than it has to when the flush is prompt.
  const eventsFlushed = examPage.waitForResponse(
    (response) =>
      response.url().includes(`/api/assessments/attempts/${encodeURIComponent(attemptId)}/events`) &&
      response.request().method() === "POST",
  );

  // Ctrl+S (save page) is intercepted at the keyboard layer — no native save dialog opens.
  await examPage.keyboard.down("Control");
  await examPage.keyboard.press("KeyS");
  await examPage.keyboard.up("Control");

  await eventsFlushed;

  const review = await expectJson<DataEnvelope<AttemptReview>>(
    await actors.tutor.get(`/api/assessments/attempts/${encodeURIComponent(attemptId)}?view=review`),
    200,
  );
  expect(review.data.eventCounts.context_menu_attempt ?? 0).toBeGreaterThan(0);
  expect(review.data.eventCounts.paste_attempt ?? 0).toBeGreaterThan(0);
  expect(review.data.eventCounts.save_attempt ?? 0).toBeGreaterThan(0);
});
