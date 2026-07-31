"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import styles from "./assessments.module.css";

type Question = {
  id: string;
  orderIndex: number;
  type: "multiple_choice" | "short_answer" | "numeric" | "essay" | "code";
  prompt: string;
  choices: { key: string; label: string }[] | null;
  points: number;
};

type SerializedSession = {
  assessment: { id: string; title: string; description: string | null; type: string };
  version: {
    versionNumber: number;
    settings: {
      durationSeconds: number | null;
      fullscreenRequired: boolean;
      camera: { required: boolean; policyVersion: string | null };
    };
  };
  attempt: { id: string; status: string; startedAt: string };
  questions: Question[];
  answers: { questionId: string; answerText: string | null }[];
  deadlineAt: string | null;
};

type Preflight = {
  assessment: SerializedSession["assessment"];
  version: SerializedSession["version"] & { questionCount: number };
};

type SignalType =
  | "focus_loss"
  | "fullscreen_exit"
  | "tab_switch"
  | "connectivity_interruption"
  | "copy_attempt"
  | "paste_attempt";

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

export function AssessmentEntry({ assessmentId }: { assessmentId: string }) {
  const t = useTranslations("assessments");
  const [preflight, setPreflight] = useState<Preflight | null>(null);
  const [session, setSession] = useState<SerializedSession | null>(null);
  const [cameraAccepted, setCameraAccepted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void fetch(`/api/assessments/${encodeURIComponent(assessmentId)}`)
      .then(async (response) => {
        const payload = (await response.json()) as unknown;
        if (!response.ok) throw new Error(messageFromResponse(payload, t("errors.load")));
        return payload as { data: Preflight };
      })
      .then((payload) => {
        if (active) setPreflight(payload.data);
      })
      .catch((caught: unknown) => {
        if (active) setError(caught instanceof Error ? caught.message : t("errors.load"));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [assessmentId, t]);

  async function start() {
    if (!preflight) return;
    setStarting(true);
    setError(null);
    try {
      if (preflight.version.settings.fullscreenRequired && !document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
      const policyVersion = preflight.version.settings.camera.policyVersion;
      const response = await fetch(
        `/api/assessments/${encodeURIComponent(assessmentId)}/attempts`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            cameraConsent:
              preflight.version.settings.camera.required && policyVersion
                ? { accepted: cameraAccepted, policyVersion }
                : null,
          }),
        },
      );
      const payload = (await response.json()) as unknown;
      if (!response.ok) throw new Error(messageFromResponse(payload, t("errors.start")));
      setSession((payload as { data: SerializedSession }).data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("errors.start"));
    } finally {
      setStarting(false);
    }
  }

  if (loading) return <p className={styles.statePanel}>{t("entry.loading")}</p>;
  if (!preflight)
    return (
      <p className={styles.errorPanel} role="alert">
        {error ?? t("errors.load")}
      </p>
    );
  if (session) return <AssessmentRunner session={session} />;

  const settings = preflight.version.settings;
  return (
    <div className={styles.shell}>
      <Link className={styles.backLink} href="/assessments">
        ← {t("entry.back")}
      </Link>
      <header className={styles.entryHeader}>
        <div>
          <p className={styles.eyebrow}>{t(`types.${preflight.assessment.type}`)}</p>
          <h1>{preflight.assessment.title}</h1>
          <p>{preflight.assessment.description ?? t("entry.noDescription")}</p>
        </div>
        <dl className={styles.brief}>
          <div>
            <dt>{t("entry.questions")}</dt>
            <dd>{preflight.version.questionCount}</dd>
          </div>
          <div>
            <dt>{t("entry.time")}</dt>
            <dd>
              {settings.durationSeconds
                ? t("entry.minutes", { count: Math.ceil(settings.durationSeconds / 60) })
                : t("entry.untimed")}
            </dd>
          </div>
          <div>
            <dt>{t("entry.version")}</dt>
            <dd>{preflight.version.versionNumber}</dd>
          </div>
        </dl>
      </header>

      <section className={styles.notice} aria-labelledby="collection-notice-title">
        <p className={styles.noticeLabel}>{t("entry.notice.label")}</p>
        <h2 id="collection-notice-title">{t("entry.notice.title")}</h2>
        <p>{t("entry.notice.body")}</p>
        <ul>
          <li>{t("entry.notice.timing")}</li>
          <li>{t("entry.notice.focus")}</li>
          <li>{t("entry.notice.connection")}</li>
          <li>{t("entry.notice.answers")}</li>
        </ul>
        <p className={styles.notProof}>{t("entry.notice.notProof")}</p>
      </section>

      <section className={styles.startPanel}>
        <div>
          <h2>{t("entry.ready.title")}</h2>
          <p>
            {settings.fullscreenRequired ? t("entry.ready.fullscreen") : t("entry.ready.standard")}
          </p>
        </div>
        {settings.camera.required ? (
          <label className={styles.consentCheck}>
            <input
              checked={cameraAccepted}
              onChange={(event) => setCameraAccepted(event.target.checked)}
              type="checkbox"
            />
            <span>{t("entry.cameraConsent", { policy: settings.camera.policyVersion ?? "" })}</span>
          </label>
        ) : null}
        {error ? (
          <p className={styles.inlineError} role="alert">
            {error}
          </p>
        ) : null}
        <button
          className={styles.primaryButton}
          disabled={starting || (settings.camera.required && !cameraAccepted)}
          onClick={() => void start()}
          type="button"
        >
          {starting ? t("entry.starting") : t("entry.start")}
        </button>
      </section>
    </div>
  );
}

function AssessmentRunner({ session }: { session: SerializedSession }) {
  const t = useTranslations("assessments");
  const fullscreenEntered = useRef(false);
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
  const duration = session.version.settings.durationSeconds;
  const [remaining, setRemaining] = useState(() =>
    session.deadlineAt
      ? Math.max(0, Math.ceil((new Date(session.deadlineAt).getTime() - Date.now()) / 1_000))
      : null,
  );

  const sendSignal = useCallback(
    (
      eventType: SignalType,
      metadata: Record<string, string | number | boolean | null> | null = null,
    ) => {
      void fetch(`/api/assessments/attempts/${encodeURIComponent(session.attempt.id)}/events`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        keepalive: true,
        body: JSON.stringify({ eventType, clientOccurredAt: new Date().toISOString(), metadata }),
      });
    },
    [session.attempt.id],
  );

  useEffect(() => {
    fullscreenEntered.current = Boolean(document.fullscreenElement);
    function visibility() {
      if (document.visibilityState === "hidden") sendSignal("tab_switch");
    }
    function blur() {
      sendSignal("focus_loss");
    }
    function fullscreen() {
      if (document.fullscreenElement) fullscreenEntered.current = true;
      else if (fullscreenEntered.current) sendSignal("fullscreen_exit");
    }
    function offline() {
      sendSignal("connectivity_interruption", { state: "offline" });
    }
    document.addEventListener("visibilitychange", visibility);
    document.addEventListener("fullscreenchange", fullscreen);
    window.addEventListener("blur", blur);
    window.addEventListener("offline", offline);
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      document.removeEventListener("fullscreenchange", fullscreen);
      window.removeEventListener("blur", blur);
      window.removeEventListener("offline", offline);
    };
  }, [sendSignal]);

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

  async function save(questionId: string, answerText = answers[questionId] ?? "") {
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
  }

  async function submit() {
    if (!honorAccepted) return;
    setSubmitting(true);
    setError(null);
    try {
      if (remaining !== 0) {
        await Promise.all(session.questions.map((question) => save(question.id)));
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
      setSubmitted(true);
      if (document.fullscreenElement) {
        fullscreenEntered.current = false;
        await document.exitFullscreen();
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("errors.submit"));
    } finally {
      setSubmitting(false);
    }
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
    <div
      className={styles.runner}
      onCopy={() => sendSignal("copy_attempt")}
      onPaste={() => sendSignal("paste_attempt")}
    >
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

      {remaining === 0 ? <p className={styles.elapsedNotice}>{t("runner.elapsedNotice")}</p> : null}

      <main className={styles.questionStack}>
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
                onBlur={() => void save(question.id)}
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
                onBlur={() => void save(question.id)}
                onChange={(event) =>
                  setAnswers((current) => ({ ...current, [question.id]: event.target.value }))
                }
                placeholder={t(`runner.placeholders.${question.type}`)}
                value={answers[question.id] ?? ""}
              />
            )}
          </section>
        ))}
      </main>

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
    </div>
  );
}
