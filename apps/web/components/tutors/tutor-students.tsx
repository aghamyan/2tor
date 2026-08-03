import Link from "next/link";
import { getTranslations } from "next-intl/server";

import type { TutorStudentSummary } from "../../app/(app)/tutors/queries";
import { initials } from "./initials";
import styles from "./tutors.module.css";

export async function TutorStudents({
  active,
  past,
}: {
  active: TutorStudentSummary[];
  past: TutorStudentSummary[];
}) {
  const t = await getTranslations("tutors.students");
  const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium" });
  const dateTimeFormat = new Intl.DateTimeFormat("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  function card(student: TutorStudentSummary, isPast: boolean) {
    return (
      <div className={styles.studentCard} key={student.assignmentId}>
        <div className={styles.studentCardTop}>
          <span className={styles.avatar} aria-hidden="true">
            {initials(student.studentName)}
          </span>
          <div>
            <strong>{student.studentName}</strong>
            <p className={styles.previewSubjects}>
              {[student.subjectName, student.gradeLevel].filter(Boolean).join(" · ") || t("noDetails")}
            </p>
          </div>
        </div>
        <div className={styles.studentMeta}>
          {isPast && student.endedAt ? (
            <span>{t("endedOn", { date: dateFormat.format(student.endedAt) })}</span>
          ) : null}
          {!isPast && student.nextLessonAt ? (
            <span>{t("nextClass", { date: dateTimeFormat.format(student.nextLessonAt) })}</span>
          ) : !isPast ? (
            <span>{t("noNextClass")}</span>
          ) : null}
          {student.publishedFeedbackCount > 0 ? (
            <span>{t("feedbackCount", { count: student.publishedFeedbackCount })}</span>
          ) : null}
        </div>
        <div className={styles.studentActions}>
          <Link className={styles.buttonSecondary} href="/academics">
            {t("viewLearningPlan")}
          </Link>
          {!isPast ? (
            <Link className={styles.buttonGhost} href="/communication">
              {t("message")}
            </Link>
          ) : null}
        </div>
      </div>
    );
  }

  const hasAny = active.length > 0 || past.length > 0;

  return (
    <div className={styles.workspace}>
      <nav className={styles.breadcrumb} aria-label={t("breadcrumbLabel")}>
        <Link href="/dashboard">{t("breadcrumbOverview")}</Link> / {t("breadcrumbCurrent")}
      </nav>

      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>{t("eyebrow")}</p>
          <h1 className={styles.title}>{t("title")}</h1>
          <p className={styles.subtitle}>{t("subtitle")}</p>
        </div>
      </header>

      {!hasAny ? (
        <div className={styles.card}>
          <div className={styles.emptyState}>
            <h3>{t("emptyTitle")}</h3>
            <p>{t("emptyBody")}</p>
            <div className={styles.studentActions}>
              <Link className={styles.buttonPrimary} href="/tutors">
                {t("emptyPrimaryCta")}
              </Link>
              <Link className={styles.buttonSecondary} href="/tutors#weekly-availability">
                {t("emptySecondaryCta")}
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <>
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h2 className={styles.cardTitle}>{t("activeTitle")}</h2>
                <p className={styles.cardDescription}>{t("activeDescription")}</p>
              </div>
            </div>
            {active.length === 0 ? (
              <div className={styles.emptyState}>
                <h3>{t("noActiveTitle")}</h3>
                <p>{t("noActiveBody")}</p>
              </div>
            ) : (
              <div className={styles.studentGrid}>{active.map((student) => card(student, false))}</div>
            )}
          </section>

          {past.length > 0 ? (
            <section className={styles.card}>
              <div className={styles.cardHeader}>
                <div>
                  <h2 className={styles.cardTitle}>{t("pastTitle")}</h2>
                  <p className={styles.cardDescription}>{t("pastDescription")}</p>
                </div>
              </div>
              <div className={styles.studentGrid}>{past.map((student) => card(student, true))}</div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
