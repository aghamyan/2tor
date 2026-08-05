"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import styles from "./assessments.module.css";

type AttemptStatus = "in_progress" | "submitted" | "graded" | "abandoned";
type Severity = "low" | "medium" | "high";

interface AttemptListItem {
  id: string;
  studentName: string;
  status: AttemptStatus;
  startedAt: string;
  submittedAt: string | null;
  score: number | null;
  maxScore: number | null;
  proctorMode: "none" | "camera_required";
  suspicion: { score: number; severity: Severity };
}

interface AttemptListPage {
  items: AttemptListItem[];
  nextCursor: string | null;
}

interface AssessmentSummary {
  id: string;
  title: string;
  description: string | null;
  type: string;
}

interface AssessmentDetailPayload {
  assessment: AssessmentSummary;
  canDelete: boolean;
}

function responseMessage(payload: unknown, fallback: string) {
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

/** Tutor/staff landing page for an assessment: who finished, and was anything flagged (spec §16). */
export function AssessmentAttempts({ assessmentId }: { assessmentId: string }) {
  const t = useTranslations("assessments");
  const router = useRouter();
  const [assessment, setAssessment] = useState<AssessmentSummary | null>(null);
  const [canDelete, setCanDelete] = useState(false);
  const [items, setItems] = useState<AttemptListItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.all([
      fetch(`/api/assessments/${encodeURIComponent(assessmentId)}`).then(async (response) => {
        const payload = (await response.json()) as unknown;
        if (!response.ok) throw new Error(responseMessage(payload, t("errors.load")));
        return payload as { data: AssessmentDetailPayload };
      }),
      fetch(`/api/assessments/${encodeURIComponent(assessmentId)}/attempts`).then(async (response) => {
        const payload = (await response.json()) as unknown;
        if (!response.ok) throw new Error(responseMessage(payload, t("errors.load")));
        return payload as { data: AttemptListPage };
      }),
    ])
      .then(([assessmentPayload, attemptsPayload]) => {
        if (!active) return;
        setAssessment(assessmentPayload.data.assessment);
        setCanDelete(assessmentPayload.data.canDelete);
        setItems(attemptsPayload.data.items);
        setNextCursor(attemptsPayload.data.nextCursor);
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

  async function loadMore() {
    if (!nextCursor) return;
    setLoadingMore(true);
    try {
      const response = await fetch(
        `/api/assessments/${encodeURIComponent(assessmentId)}/attempts?cursor=${encodeURIComponent(nextCursor)}`,
      );
      const payload = (await response.json()) as unknown;
      if (!response.ok) throw new Error(responseMessage(payload, t("errors.load")));
      const page = payload as { data: AttemptListPage };
      setItems((current) => [...current, ...page.data.items]);
      setNextCursor(page.data.nextCursor);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("errors.load"));
    } finally {
      setLoadingMore(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(t("attempts.deleteConfirm"))) return;
    setDeleting(true);
    setError(null);
    try {
      const response = await fetch(`/api/assessments/${encodeURIComponent(assessmentId)}`, {
        method: "DELETE",
      });
      const payload = (await response.json()) as unknown;
      if (!response.ok) throw new Error(responseMessage(payload, t("errors.delete")));
      router.push("/assessments");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("errors.delete"));
      setDeleting(false);
    }
  }

  if (loading) return <p className={styles.statePanel}>{t("attempts.loading")}</p>;
  if (!assessment) {
    return (
      <p className={styles.errorPanel} role="alert">
        {error ?? t("errors.load")}
      </p>
    );
  }

  return (
    <div className={styles.reviewShell}>
      <Link className={styles.backLink} href="/assessments">
        ← {t("attempts.back")}
      </Link>
      <header className={styles.reviewHeader}>
        <div>
          <p className={styles.eyebrow}>{t("attempts.kicker")}</p>
          <h1>{assessment.title}</h1>
        </div>
        <span className={styles.count}>{items.length}</span>
        {canDelete ? (
          <button
            className={styles.buttonDanger}
            disabled={deleting}
            onClick={() => void handleDelete()}
            type="button"
          >
            {deleting ? t("attempts.deleting") : t("attempts.delete")}
          </button>
        ) : null}
      </header>

      {error ? (
        <p className={styles.inlineError} role="alert">
          {error}
        </p>
      ) : null}

      {items.length === 0 ? (
        <p className={styles.empty}>{t("attempts.empty")}</p>
      ) : (
        <ul className={styles.attemptsList}>
          {items.map((item) => (
            <li key={item.id}>
              <Link className={styles.attemptRow} href={`/assessments/attempts/${item.id}/review`}>
                <span className={styles.attemptStudent}>{item.studentName}</span>
                <span className={styles.statusTag}>{t(`statuses.${item.status}`)}</span>
                <span>
                  {item.submittedAt
                    ? t("attempts.submittedAt", {
                        date: new Date(item.submittedAt).toLocaleString(),
                      })
                    : t("attempts.stillInProgress")}
                </span>
                <span
                  className={`${styles.severityTag} ${styles[`severity_${item.suspicion.severity}`]}`}
                >
                  {t(`review.suspicion.severity.${item.suspicion.severity}`)}
                </span>
                <b aria-hidden="true">↗</b>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {nextCursor ? (
        <button
          className={styles.secondaryButton}
          disabled={loadingMore}
          onClick={() => void loadMore()}
          type="button"
        >
          {loadingMore ? t("attempts.loadingMore") : t("attempts.loadMore")}
        </button>
      ) : null}
    </div>
  );
}
