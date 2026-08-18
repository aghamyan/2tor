"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import styles from "./assessments.module.css";

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

type Preflight = {
  assessment: { id: string; title: string; description: string | null; type: string };
  version: {
    versionNumber: number;
    questionCount: number;
    settings: {
      durationSeconds: number | null;
      fullscreenRequired: boolean;
      camera: CameraSettings;
      maxAttempts: number | null;
      integrityPolicy: IntegrityPolicySettings;
    };
  };
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

function examRunUrl(attemptId: string) {
  return `/assessments/attempts/${encodeURIComponent(attemptId)}/run`;
}

/**
 * The exam itself runs in a dedicated tab (`ExamRun`, at `/assessments/attempts/<id>/run`) so its
 * camera preview, live detection console, and fullscreen lock get a clean document of their own
 * rather than living awkwardly inside this overview/consent page. This screen only collects the
 * disclosed notice + camera consent and starts the attempt server-side; the new tab then owns
 * camera confirmation, fullscreen entry, and the actual question flow.
 */
export function AssessmentEntry({ assessmentId }: { assessmentId: string }) {
  const t = useTranslations("assessments");
  const [preflight, setPreflight] = useState<Preflight | null>(null);
  const [cameraAccepted, setCameraAccepted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [examUrl, setExamUrl] = useState<string | null>(null);
  const [examOpenedAutomatically, setExamOpenedAutomatically] = useState(false);

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
    // Opened synchronously, inside the click handler, so it never gets treated as a popup — the
    // navigation is filled in once the attempt exists. The exam tab requests its own camera
    // access and fullscreen from its own click; a MediaStream from this tab couldn't be handed
    // to another tab/document even if we wanted to.
    const examWindow = window.open("", "_blank");
    try {
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
      const attemptId = (payload as { data: { attempt: { id: string } } }).data.attempt.id;
      const url = examRunUrl(attemptId);
      setExamUrl(url);
      if (examWindow) {
        examWindow.location.href = url;
        setExamOpenedAutomatically(true);
      }
    } catch (caught) {
      examWindow?.close();
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

  if (examUrl) {
    return (
      <div className={styles.shell}>
        <section className={styles.startPanel}>
          <div>
            <h2>{t("entry.opened.title")}</h2>
            <p>
              {examOpenedAutomatically ? t("entry.opened.body") : t("entry.opened.blockedBody")}
            </p>
          </div>
          <a
            className={styles.primaryButton}
            href={examUrl}
            onClick={(event) => {
              event.preventDefault();
              window.open(examUrl, "_blank");
            }}
          >
            {t("entry.opened.action")}
          </a>
          <Link className={styles.backLink} href="/assessments">
            ← {t("entry.back")}
          </Link>
        </section>
      </div>
    );
  }

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
          {settings.maxAttempts !== null ? (
            <div>
              <dt>{t("entry.attemptsAllowed")}</dt>
              <dd>{settings.maxAttempts}</dd>
            </div>
          ) : null}
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
          {settings.fullscreenRequired ? <li>{t("entry.notice.examMode")}</li> : null}
          {settings.camera.required ? <li>{t("entry.notice.camera")}</li> : null}
          {settings.camera.headTrackingEnabled ? <li>{t("entry.notice.headTracking")}</li> : null}
          {settings.camera.objectDetectionEnabled ? <li>{t("entry.notice.objectDetection")}</li> : null}
          {settings.camera.evidenceCaptureEnabled ? <li>{t("entry.notice.evidenceCapture")}</li> : null}
          <li>{t("entry.notice.newTab")}</li>
          {settings.integrityPolicy.action !== "log_only" && settings.integrityPolicy.violationLimit !== null ? (
            <li>
              {t(`entry.notice.integrityPolicy.${settings.integrityPolicy.action}`, {
                count: settings.integrityPolicy.violationLimit,
              })}
            </li>
          ) : null}
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
