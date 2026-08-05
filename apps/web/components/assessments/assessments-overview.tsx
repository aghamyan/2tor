"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import styles from "./assessments.module.css";

interface AssessmentListItem {
  id: string;
  title: string;
  description: string | null;
  type: "diagnostic" | "quiz" | "exam" | "practice";
  status: "draft" | "published" | "archived";
}

export function AssessmentsOverview({ canCreate = false }: { canCreate?: boolean }) {
  const t = useTranslations("assessments");
  const [assessments, setAssessments] = useState<AssessmentListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void fetch("/api/assessments")
      .then(async (response) => {
        if (!response.ok) throw new Error("list_failed");
        return response.json() as Promise<{ data: AssessmentListItem[] }>;
      })
      .then((payload) => {
        if (active) setAssessments(payload.data);
      })
      .catch(() => {
        if (active) setAssessments([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className={styles.shell}>
      <header className={styles.overviewHeader}>
        <p className={styles.eyebrow}>{t("overview.kicker")}</p>
        <h1>{t("overview.title")}</h1>
        <p className={styles.lede}>{t("overview.intro")}</p>
        {canCreate ? (
          <Link className={styles.secondaryButton} href="/assessments/new">
            {t("overview.actions.create")}
          </Link>
        ) : null}
      </header>

      <section className={styles.contract} aria-labelledby="signal-contract-title">
        <div className={styles.contractMark} aria-hidden="true">
          i
        </div>
        <div>
          <h2 id="signal-contract-title">{t("overview.contract.title")}</h2>
          <p>{t("overview.contract.body")}</p>
        </div>
      </section>

      <div className={styles.workflowGrid}>
        {(["prepare", "take", "review"] as const).map((key) => (
          <article className={styles.workflowCard} key={key}>
            <span>{t(`overview.${key}.label`)}</span>
            <h2>{t(`overview.${key}.title`)}</h2>
            <p>{t(`overview.${key}.body`)}</p>
          </article>
        ))}
      </div>

      <section className={styles.assessmentList} aria-labelledby="available-assessments-title">
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>{t("overview.library.kicker")}</p>
            <h2 id="available-assessments-title">{t("overview.library.title")}</h2>
          </div>
          <span className={styles.count}>{assessments.length}</span>
        </div>
        {loading ? (
          <p className={styles.empty}>{t("overview.library.loading")}</p>
        ) : assessments.length === 0 ? (
          <p className={styles.empty}>{t("overview.library.empty")}</p>
        ) : (
          <ul>
            {assessments.map((assessment) => (
              <li key={assessment.id}>
                <a href={`/assessments/${assessment.id}`} className={styles.assessmentLink}>
                  <span className={styles.typeTag}>{t(`types.${assessment.type}`)}</span>
                  <strong>{assessment.title}</strong>
                  <span>{assessment.description ?? t("overview.library.noDescription")}</span>
                  <b aria-hidden="true">↗</b>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
