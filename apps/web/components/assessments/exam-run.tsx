"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import styles from "./assessments.module.css";
import { CameraPreflight } from "./proctoring/camera-preflight";
import type { CameraHandle } from "./proctoring/camera-service";
import { IntegrityPolicyBanner } from "./proctoring/integrity-policy-banner";
import { ProctoringConsole } from "./proctoring/proctoring-console";
import { SuspicionBanner } from "./proctoring/suspicion-banner";
import { useExamProctoring } from "./proctoring/use-exam-proctoring";

type Question = {
  id: string;
  orderIndex: number;
  type: "multiple_choice" | "short_answer" | "numeric" | "essay" | "code";
  prompt: string;
  choices: { key: string; label: string }[] | null;
  points: number;
};

type CameraSettings = {
  required: boolean;
  policyVersion: string | null;
  headTrackingEnabled: boolean;
  objectDetectionEnabled: boolean;
  evidenceCaptureEnabled: boolean;
};
type IntegrityPolicySettings = {
  violationLimit: number | null;
  action: "log_only" | "warn" | "auto_submit";
};

type SerializedSession = {
  assessment: { id: string; title: string; description: string | null; type: string };
  version: {
    versionNumber: number;
    settings: {
      durationSeconds: number | null;
      fullscreenRequired: boolean;
      camera: CameraSettings;
      maxAttempts: number | null;
      integrityPolicy: IntegrityPolicySettings;
    };
  };
  attempt: { id: string; status: string; startedAt: string };
  questions: Question[];
  answers: { questionId: string; answerText: string | null }[];
  deadlineAt: string | null;
};

function messageFromResponse(payload: unknown, fallback: string) {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    typeof payload.error === "object" &&
    payload.error !== null &&
    "message" in payload.error &&
    typeof payload.error.message === "string"
  ) {
    return payload.error.message;
  }
  return fallback;
}

function formatTime(seconds: number) {
  const safe = Math.max(0, seconds);
  const hours = Math.floor(safe / 3_600);
  const minutes = Math.floor((safe % 3_600) / 60);
  const remainder = safe % 60;
  return hours > 0
    ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`
    : `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

/**
 * The dedicated exam tab (opened by `AssessmentEntry` via `window.open`). The attempt already
 * exists server-side by the time this mounts — consent and the honor-statement notice were shown
 * on the entry tab — so this only needs to (1) confirm the camera works, since a fresh tab has no
 * access to a MediaStream obtained in another tab/document, and (2) request fullscreen, since both
 * require a real user gesture this tab hasn't had yet. Both happen from the same "Begin exam" click.
 */
export function ExamRun({ attemptId }: { attemptId: string }) {
  const t = useTranslations("assessments");
  const [session, setSession] = useState<SerializedSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cameraHandle, setCameraHandle] = useState<CameraHandle | null>(null);
  const cameraHandleRef = useRef<CameraHandle | null>(null);
  const [phase, setPhase] = useState<"ready" | "running">("ready");
  const [entering, setEntering] = useState(false);
  const [enterError, setEnterError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void fetch(`/api/assessments/attempts/${encodeURIComponent(attemptId)}`)
      .then(async (response) => {
        const payload = (await response.json()) as unknown;
        if (!response.ok) throw new Error(messageFromResponse(payload, t("errors.load")));
        return payload as { data: SerializedSession };
      })
      .then((payload) => {
        if (active) setSession(payload.data);
      })
      .catch((caught: unknown) => {
        if (active) setLoadError(caught instanceof Error ? caught.message : t("errors.load"));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [attemptId, t]);

  useEffect(() => {
    return () => {
      if (phase !== "running") cameraHandleRef.current?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once on unmount; `phase` read via closure.
  }, []);

  function handleCameraReady(handle: CameraHandle) {
    cameraHandleRef.current = handle;
    setCameraHandle(handle);
  }

  async function beginExam() {
    if (!session) return;
    setEntering(true);
    setEnterError(null);
    // Best-effort: some browsers (and popup/auxiliary windows specifically) can reject a
    // fullscreen request that would succeed from a plain top-level click. Never let that failure
    // strand the student on this screen — ExamRunner's own fullscreenExited banner (see
    // use-exam-proctoring.ts) picks this up immediately and offers a direct, same-document retry.
    if (session.version.settings.fullscreenRequired && !document.fullscreenElement) {
      try {
        await document.documentElement.requestFullscreen();
      } catch {
        setEnterError(t("errors.fullscreen"));
      }
    }
    setPhase("running");
    setEntering(false);
  }

  if (loading) return <p className={styles.statePanel}>{t("entry.loading")}</p>;
  if (!session)
    return (
      <p className={styles.errorPanel} role="alert">
        {loadError ?? t("errors.load")}
      </p>
    );

  if (phase === "ready") {
    const settings = session.version.settings;
    const cameraReady = !settings.camera.required || cameraHandle !== null;
    return (
      <div className={styles.shell}>
        <header className={styles.entryHeader}>
          <div>
            <p className={styles.eyebrow}>{t("runner.inProgress")}</p>
            <h1>{session.assessment.title}</h1>
          </div>
        </header>

        <section className={styles.startPanel}>
          <div>
            <h2>{t("entry.ready.title")}</h2>
            <p>
              {settings.fullscreenRequired ? t("entry.ready.fullscreen") : t("entry.ready.standard")}
            </p>
          </div>
          {settings.camera.required ? <CameraPreflight onReady={handleCameraReady} /> : null}
          {enterError ? (
            <p className={styles.inlineError} role="alert">
              {enterError}
            </p>
          ) : null}
          <button
            className={styles.primaryButton}
            disabled={entering || !cameraReady}
            onClick={() => void beginExam()}
            type="button"
          >
            {entering ? t("runner.entering") : t("runner.beginExam")}
          </button>
        </section>
      </div>
    );
  }

  return (
    <ExamRunner
      session={session}
      cameraHandle={cameraHandle}
      onCameraRelease={() => {
        cameraHandleRef.current?.stop();
        cameraHandleRef.current = null;
        setCameraHandle(null);
      }}
    />
  );
}

function ExamRunner({
  session,
  cameraHandle,
  onCameraRelease,
}: {
  session: SerializedSession;
  cameraHandle: CameraHandle | null;
  onCameraRelease: () => void;
}) {
  const t = useTranslations("assessments");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const elapsedSeconds = useRef(0);
  const [answers, setAnswers] = useState<Record<string, string>>(
    Object.fromEntries(
      session.answers.map((answer) => [answer.questionId, answer.answerText ?? ""]),
    ),
  );
  const [honorAccepted, setHonorAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const closedSideEffectsRan = useRef(false);
  const duration = session.version.settings.durationSeconds;
  const strict = session.version.settings.fullscreenRequired;
  const camera = session.version.settings.camera;
  const integrityPolicy = session.version.settings.integrityPolicy;
  const [remaining, setRemaining] = useState(() =>
    session.deadlineAt
      ? Math.max(0, Math.ceil((new Date(session.deadlineAt).getTime() - Date.now()) / 1_000))
      : null,
  );

  const proctoring = useExamProctoring({
    attemptId: session.attempt.id,
    strict,
    camera: camera.required
      ? {
          required: true,
          headTrackingEnabled: camera.headTrackingEnabled,
          objectDetectionEnabled: camera.objectDetectionEnabled,
          evidenceCaptureEnabled: camera.evidenceCaptureEnabled,
        }
      : null,
    cameraHandle,
    containerRef,
  });

  // The server ended this attempt under the tutor's auto-submit integrity policy. The terminal
  // screen below reacts directly to `proctoring.attemptClosedByPolicy`; this effect only runs the
  // one-time teardown (stop guards, drop fullscreen/camera) exactly once, via a ref rather than
  // state, since nothing here needs to trigger an additional render.
  useEffect(() => {
    if (!proctoring.attemptClosedByPolicy || submitted || closedSideEffectsRan.current) return;
    closedSideEffectsRan.current = true;
    proctoring.stopAll();
    if (document.fullscreenElement) void document.exitFullscreen();
    onCameraRelease();
    // proctoring/onCameraRelease/submitted are read via closure; this should only ever run once,
    // on the transition from false to true.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proctoring.attemptClosedByPolicy]);

  useEffect(() => {
    if (!session.deadlineAt) return;
    const timer = window.setInterval(() => {
      setRemaining(
        Math.max(
          0,
          Math.ceil((new Date(session.deadlineAt as string).getTime() - Date.now()) / 1_000),
        ),
      );
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [session.deadlineAt]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      elapsedSeconds.current += 1;
    }, 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const progress = useMemo(() => {
    if (duration === null || remaining === null) return 1;
    return Math.max(0, Math.min(1, remaining / duration));
  }, [duration, remaining]);

  const save = useCallback(
    async (questionId: string, answerText: string) => {
      if (remaining === 0) return;
      const response = await fetch(
        `/api/assessments/attempts/${encodeURIComponent(session.attempt.id)}/answers/${encodeURIComponent(questionId)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            answerText: answerText || null,
            timeSpentSeconds: elapsedSeconds.current,
          }),
        },
      );
      if (!response.ok) {
        const payload = (await response.json()) as unknown;
        setError(messageFromResponse(payload, t("errors.save")));
      }
    },
    [remaining, session.attempt.id, t],
  );

  async function submit() {
    if (!honorAccepted) return;
    setSubmitting(true);
    setError(null);
    try {
      if (remaining !== 0) {
        await Promise.all(
          session.questions.map((question) => save(question.id, answers[question.id] ?? "")),
        );
      }
      const response = await fetch(
        `/api/assessments/attempts/${encodeURIComponent(session.attempt.id)}/submit`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ honorStatementAccepted: honorAccepted }),
        },
      );
      const payload = (await response.json()) as unknown;
      if (!response.ok) throw new Error(messageFromResponse(payload, t("errors.submit")));
      // Stop every guard before touching fullscreen/camera so their own teardown side effects
      // (fullscreenchange, track "ended") never re-enter as signals against a closed attempt.
      proctoring.stopAll();
      setSubmitted(true);
      if (document.fullscreenElement) await document.exitFullscreen();
      onCameraRelease();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("errors.submit"));
    } finally {
      setSubmitting(false);
    }
  }

  if (proctoring.attemptClosedByPolicy) {
    return (
      <section className={styles.completion}>
        <span aria-hidden="true">■</span>
        <p className={styles.eyebrow}>{t("runner.closedByPolicy.kicker")}</p>
        <h1>{t("runner.closedByPolicy.title")}</h1>
        <p>{t("runner.closedByPolicy.body")}</p>
        <Link className={styles.primaryButton} href="/assessments">
          {t("runner.closedByPolicy.back")}
        </Link>
      </section>
    );
  }

  if (submitted) {
    return (
      <section className={styles.completion}>
        <span aria-hidden="true">✓</span>
        <p className={styles.eyebrow}>{t("runner.complete.kicker")}</p>
        <h1>{t("runner.complete.title")}</h1>
        <p>{t("runner.complete.body")}</p>
        <Link className={styles.primaryButton} href="/assessments">
          {t("runner.complete.back")}
        </Link>
      </section>
    );
  }

  return (
    <div className={strict ? `${styles.runner} ${styles.examLocked}` : styles.runner} ref={containerRef}>
      <aside className={styles.timeRail} aria-label={t("runner.timeRemaining")}>
        <div style={{ transform: `scaleY(${progress})` }} />
      </aside>
      <header className={styles.runnerHeader}>
        <div>
          <p className={styles.eyebrow}>{t("runner.inProgress")}</p>
          <h1>{session.assessment.title}</h1>
        </div>
        <div className={remaining === 0 ? styles.timerElapsed : styles.timer}>
          <span>{remaining === null ? t("entry.untimed") : formatTime(remaining)}</span>
          <small>{remaining === 0 ? t("runner.elapsed") : t("runner.remaining")}</small>
        </div>
      </header>

      {strict && proctoring.fullscreenExited ? (
        <div className={styles.fullscreenPrompt} role="alertdialog" aria-labelledby="fullscreen-prompt-title">
          <p id="fullscreen-prompt-title">{t("proctoring.fullscreen.exited")}</p>
          <button
            className={styles.primaryButton}
            onClick={() => proctoring.requestFullscreenReentry()}
            type="button"
          >
            {t("proctoring.fullscreen.reenter")}
          </button>
        </div>
      ) : null}

      {remaining === 0 ? <p className={styles.elapsedNotice}>{t("runner.elapsedNotice")}</p> : null}

      <div className={camera.required ? styles.examColumns : undefined}>
        {camera.required ? (
          <aside className={styles.examLeft}>
            <ProctoringConsole
              videoRef={proctoring.videoRef}
              frame={proctoring.frame}
              objectFrame={proctoring.objectFrame}
              cameraDisconnected={proctoring.cameraDisconnected}
              faceTrackingUnavailable={proctoring.faceTrackingUnavailable}
              suspicion={proctoring.suspicion}
              events={proctoring.events}
            />
            <SuspicionBanner suspicion={proctoring.suspicion} bus={proctoring.bus} />
            <IntegrityPolicyBanner
              violationCount={proctoring.integrityViolationCount}
              policy={integrityPolicy}
              bus={proctoring.bus}
            />
          </aside>
        ) : null}

        <main className={camera.required ? styles.examRight : styles.questionStack}>
          {!camera.required ? (
            <>
              <SuspicionBanner suspicion={proctoring.suspicion} bus={proctoring.bus} />
              <IntegrityPolicyBanner
                violationCount={proctoring.integrityViolationCount}
                policy={integrityPolicy}
                bus={proctoring.bus}
              />
            </>
          ) : null}

          <div className={styles.questionStack}>
            {session.questions.map((question, index) => (
              <section className={styles.questionCard} key={question.id}>
                <header>
                  <span>
                    {t("runner.question", { current: index + 1, total: session.questions.length })}
                  </span>
                  <small>{t("runner.points", { count: question.points })}</small>
                </header>
                <h2>{question.prompt}</h2>
                {question.type === "multiple_choice" && question.choices ? (
                  <fieldset disabled={remaining === 0}>
                    <legend className={styles.srOnly}>{t("runner.chooseAnswer")}</legend>
                    {question.choices.map((choice) => (
                      <label className={styles.choice} key={choice.key}>
                        <input
                          checked={answers[question.id] === choice.key}
                          name={question.id}
                          onChange={() => {
                            setAnswers((current) => ({ ...current, [question.id]: choice.key }));
                            void save(question.id, choice.key);
                          }}
                          type="radio"
                          value={choice.key}
                        />
                        <span>{choice.label}</span>
                      </label>
                    ))}
                  </fieldset>
                ) : question.type === "essay" || question.type === "code" ? (
                  <textarea
                    className={question.type === "code" ? styles.codeAnswer : styles.longAnswer}
                    disabled={remaining === 0}
                    onBlur={() => void save(question.id, answers[question.id] ?? "")}
                    onChange={(event) =>
                      setAnswers((current) => ({ ...current, [question.id]: event.target.value }))
                    }
                    placeholder={t(`runner.placeholders.${question.type}`)}
                    value={answers[question.id] ?? ""}
                  />
                ) : (
                  <input
                    className={styles.shortAnswer}
                    disabled={remaining === 0}
                    inputMode={question.type === "numeric" ? "decimal" : "text"}
                    onBlur={() => void save(question.id, answers[question.id] ?? "")}
                    onChange={(event) =>
                      setAnswers((current) => ({ ...current, [question.id]: event.target.value }))
                    }
                    placeholder={t(`runner.placeholders.${question.type}`)}
                    value={answers[question.id] ?? ""}
                  />
                )}
              </section>
            ))}
          </div>

          <section className={styles.submitPanel}>
            <div>
              <p className={styles.eyebrow}>{t("runner.submit.kicker")}</p>
              <h2>{t("runner.submit.title")}</h2>
              <p>{t("runner.submit.body")}</p>
            </div>
            <label className={styles.honorCheck}>
              <input
                checked={honorAccepted}
                onChange={(event) => setHonorAccepted(event.target.checked)}
                type="checkbox"
              />
              <span>{t("runner.submit.honor")}</span>
            </label>
            {error ? (
              <p className={styles.inlineError} role="alert">
                {error}
              </p>
            ) : null}
            <button
              className={styles.primaryButton}
              disabled={!honorAccepted || submitting}
              onClick={() => void submit()}
              type="button"
            >
              {submitting ? t("runner.submit.submitting") : t("runner.submit.action")}
            </button>
          </section>
        </main>
      </div>
    </div>
  );
}
