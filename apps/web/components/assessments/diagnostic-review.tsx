"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import styles from "./assessments.module.css";

type SuspicionSummary = {
  score: number;
  severity: "low" | "medium" | "high";
  breakdown: { eventType: string; count: number; points: number }[];
  stats: {
    faceVisiblePercent: number | null;
    tabSwitchCount: number;
    fullscreenExitCount: number;
    copyAttemptCount: number;
    pasteAttemptCount: number;
    cameraDisconnectCount: number;
    multipleFacesCount: number;
    warningCount: number;
    totalDurationSeconds: number | null;
  };
};

type Review = {
  assessment: { title: string };
  version: { questions: { id: string; prompt: string; points: number }[] };
  attempt: { id: string; status: string; startedAt: string; submittedAt: string | null };
  answers: { questionId: string; answerText: string | null; answerChangeCount: number }[];
  events: { id: string; eventType: string; occurredAt: string; metadata: Record<string, unknown> | null }[];
  eventCounts: Record<string, number>;
  suspicion: SuspicionSummary;
  report: Report | null;
};

const HIGH_WEIGHT_EVENTS = new Set([
  "browser_minimized",
  "devtools_shortcut",
  "external_device_suspected",
  "copy_attempt",
  "paste_attempt",
]);
const MEDIUM_WEIGHT_EVENTS = new Set([
  "face_missing",
  "fullscreen_exit",
  "camera_disconnected",
  "multiple_faces",
  "cut_attempt",
  "tab_switch",
  "view_source_attempt",
]);

function eventSeverity(eventType: string): "low" | "medium" | "high" {
  if (HIGH_WEIGHT_EVENTS.has(eventType)) return "high";
  if (MEDIUM_WEIGHT_EVENTS.has(eventType)) return "medium";
  return "low";
}

function formatDuration(totalSeconds: number | null, fallback: string) {
  if (totalSeconds === null) return fallback;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

type Report = {
  id: string;
  summary: string;
  strengths: string | null;
  gaps: string | null;
  recommendedNextSteps: string | null;
  consultationAt: string | null;
  releasedToParentAt: string | null;
};

const signalTypes = [
  "tab_switch",
  "focus_loss",
  "fullscreen_exit",
  "connectivity_interruption",
  "copy_attempt",
  "paste_attempt",
  "answer_change",
] as const;

function responseMessage(payload: unknown, fallback: string) {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    typeof payload.error === "object" &&
    payload.error !== null &&
    "message" in payload.error &&
    typeof payload.error.message === "string"
  )
    return payload.error.message;
  return fallback;
}

export function DiagnosticReview({ attemptId }: { attemptId: string }) {
  const t = useTranslations("assessments");
  const [review, setReview] = useState<Review | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void fetch(`/api/assessments/attempts/${encodeURIComponent(attemptId)}?view=review`)
      .then(async (response) => {
        const payload = (await response.json()) as unknown;
        if (!response.ok) throw new Error(responseMessage(payload, t("errors.review")));
        return payload as { data: Review };
      })
      .then((payload) => {
        if (active) {
          setReview(payload.data);
          setReport(payload.data.report);
        }
      })
      .catch((caught: unknown) => {
        if (active) setError(caught instanceof Error ? caught.message : t("errors.review"));
      });
    return () => {
      active = false;
    };
  }, [attemptId, t]);

  async function writeReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    const response = await fetch(
      `/api/assessments/attempts/${encodeURIComponent(attemptId)}/report`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          summary: form.get("summary"),
          strengths: form.get("strengths") || null,
          gaps: form.get("gaps") || null,
          recommendedNextSteps: form.get("recommendedNextSteps") || null,
        }),
      },
    );
    const payload = (await response.json()) as unknown;
    if (response.ok) setReport((payload as { data: Report }).data);
    else setError(responseMessage(payload, t("errors.report")));
    setBusy(false);
  }

  async function advance(action: "consultation" | "release") {
    if (!report) return;
    setBusy(true);
    setError(null);
    const response = await fetch(
      `/api/assessments/reports/${encodeURIComponent(report.id)}/${action}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: action === "consultation" ? JSON.stringify({ consultedAt: null }) : undefined,
      },
    );
    const payload = (await response.json()) as unknown;
    if (response.ok) setReport((payload as { data: Report }).data);
    else setError(responseMessage(payload, t("errors.report")));
    setBusy(false);
  }

  if (!review) {
    return (
      <p className={error ? styles.errorPanel : styles.statePanel}>
        {error ?? t("review.loading")}
      </p>
    );
  }

  return (
    <div className={styles.reviewShell}>
      <Link className={styles.backLink} href="/assessments">
        ← {t("review.back")}
      </Link>
      <header className={styles.reviewHeader}>
        <div>
          <p className={styles.eyebrow}>{t("review.kicker")}</p>
          <h1>{review.assessment.title}</h1>
        </div>
        <span className={styles.statusTag}>{t(`statuses.${review.attempt.status}`)}</span>
      </header>

      <section className={styles.suspicionOverview} aria-labelledby="suspicion-overview-title">
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>{t("review.suspicion.kicker")}</p>
            <h2 id="suspicion-overview-title">{t("review.suspicion.title")}</h2>
          </div>
          <span className={`${styles.severityTag} ${styles[`severity_${review.suspicion.severity}`]}`}>
            {t(`review.suspicion.severity.${review.suspicion.severity}`)}
          </span>
        </div>
        <p className={styles.signalContract}>{t("review.suspicion.notProof")}</p>

        <div className={styles.suspicionScore}>
          <strong>{review.suspicion.score}</strong>
          <span>{t("review.suspicion.scoreLabel")}</span>
        </div>

        <div className={styles.signalGrid}>
          <article>
            <strong>
              {review.suspicion.stats.faceVisiblePercent === null
                ? t("review.suspicion.stats.notTracked")
                : `${review.suspicion.stats.faceVisiblePercent}%`}
            </strong>
            <span>{t("review.suspicion.stats.faceVisible")}</span>
          </article>
          <article>
            <strong>{review.suspicion.stats.tabSwitchCount}</strong>
            <span>{t("review.suspicion.stats.tabSwitches")}</span>
          </article>
          <article>
            <strong>{review.suspicion.stats.fullscreenExitCount}</strong>
            <span>{t("review.suspicion.stats.fullscreenExits")}</span>
          </article>
          <article>
            <strong>{review.suspicion.stats.copyAttemptCount + review.suspicion.stats.pasteAttemptCount}</strong>
            <span>{t("review.suspicion.stats.clipboardAttempts")}</span>
          </article>
          <article>
            <strong>{review.suspicion.stats.cameraDisconnectCount}</strong>
            <span>{t("review.suspicion.stats.cameraDisconnects")}</span>
          </article>
          <article>
            <strong>{review.suspicion.stats.multipleFacesCount}</strong>
            <span>{t("review.suspicion.stats.multipleFaces")}</span>
          </article>
          <article>
            <strong>{formatDuration(review.suspicion.stats.totalDurationSeconds, t("review.suspicion.stats.notTracked"))}</strong>
            <span>{t("review.suspicion.stats.duration")}</span>
          </article>
          <article>
            <strong>{review.suspicion.stats.warningCount}</strong>
            <span>{t("review.suspicion.stats.warningsShown")}</span>
          </article>
        </div>

        {review.suspicion.breakdown.length > 0 ? (
          <table className={styles.suspicionBreakdown}>
            <caption className={styles.srOnly}>{t("review.suspicion.breakdownCaption")}</caption>
            <thead>
              <tr>
                <th scope="col">{t("review.suspicion.breakdownColumns.type")}</th>
                <th scope="col">{t("review.suspicion.breakdownColumns.count")}</th>
                <th scope="col">{t("review.suspicion.breakdownColumns.points")}</th>
              </tr>
            </thead>
            <tbody>
              {review.suspicion.breakdown.map((entry) => (
                <tr key={entry.eventType}>
                  <td>{t(`signals.${entry.eventType}`)}</td>
                  <td>{entry.count}</td>
                  <td>{entry.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </section>

      <section className={styles.eventTimeline} aria-labelledby="event-timeline-title">
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>{t("review.timeline.kicker")}</p>
            <h2 id="event-timeline-title">{t("review.timeline.title")}</h2>
          </div>
        </div>
        {review.events.length === 0 ? (
          <p className={styles.empty}>{t("review.timeline.empty")}</p>
        ) : (
          <ol className={styles.timelineList}>
            {review.events.map((item) => {
              const severity = eventSeverity(item.eventType);
              return (
                <li key={item.id}>
                  <span className={`${styles.severityDot} ${styles[`severity_${severity}`]}`} aria-hidden="true" />
                  <time dateTime={item.occurredAt}>
                    {new Date(item.occurredAt).toLocaleTimeString()}
                  </time>
                  <span>{t(`signals.${item.eventType}`)}</span>
                  <span className={styles.srOnly}>{t(`review.suspicion.severity.${severity}`)}</span>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <section className={styles.signalReview} aria-labelledby="signal-review-title">
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>{t("review.signals.kicker")}</p>
            <h2 id="signal-review-title">{t("review.signals.title")}</h2>
          </div>
        </div>
        <p className={styles.signalContract}>{t("review.signals.contract")}</p>
        <div className={styles.signalGrid}>
          {signalTypes.map((type) => (
            <article key={type}>
              <strong>{review.eventCounts[type] ?? 0}</strong>
              <span>{t(`signals.${type}`)}</span>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.answerReview}>
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>{t("review.answers.kicker")}</p>
            <h2>{t("review.answers.title")}</h2>
          </div>
        </div>
        <ol>
          {review.version.questions
            .filter((question) =>
              review.answers.some((answer) => answer.questionId === question.id),
            )
            .map((question) => {
              const answer = review.answers.find((item) => item.questionId === question.id);
              return (
                <li key={question.id}>
                  <h3>{question.prompt}</h3>
                  <p>{answer?.answerText || t("review.answers.blank")}</p>
                  <small>
                    {t("review.answers.changes", { count: answer?.answerChangeCount ?? 0 })}
                  </small>
                </li>
              );
            })}
        </ol>
      </section>

      <form className={styles.reportForm} onSubmit={(event) => void writeReport(event)}>
        <div>
          <p className={styles.eyebrow}>{t("review.report.kicker")}</p>
          <h2>{t("review.report.title")}</h2>
          <p>{t("review.report.body")}</p>
        </div>
        <label>
          <span>{t("review.report.summary")}</span>
          <textarea defaultValue={report?.summary} name="summary" required />
        </label>
        <div className={styles.reportColumns}>
          <label>
            <span>{t("review.report.strengths")}</span>
            <textarea defaultValue={report?.strengths ?? ""} name="strengths" />
          </label>
          <label>
            <span>{t("review.report.gaps")}</span>
            <textarea defaultValue={report?.gaps ?? ""} name="gaps" />
          </label>
        </div>
        <label>
          <span>{t("review.report.nextSteps")}</span>
          <textarea defaultValue={report?.recommendedNextSteps ?? ""} name="recommendedNextSteps" />
        </label>
        {error ? (
          <p className={styles.inlineError} role="alert">
            {error}
          </p>
        ) : null}
        <button className={styles.secondaryButton} disabled={busy} type="submit">
          {t("review.report.save")}
        </button>
      </form>

      {report ? (
        <section className={styles.releasePanel}>
          <div>
            <p className={styles.eyebrow}>{t("review.release.kicker")}</p>
            <h2>{t("review.release.title")}</h2>
            <p>
              {report.releasedToParentAt
                ? t("review.release.released")
                : report.consultationAt
                  ? t("review.release.consulted")
                  : t("review.release.waiting")}
            </p>
          </div>
          {!report.consultationAt ? (
            <button
              className={styles.secondaryButton}
              disabled={busy}
              onClick={() => void advance("consultation")}
              type="button"
            >
              {t("review.release.recordConsultation")}
            </button>
          ) : !report.releasedToParentAt ? (
            <button
              className={styles.primaryButton}
              disabled={busy}
              onClick={() => void advance("release")}
              type="button"
            >
              {t("review.release.action")}
            </button>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
