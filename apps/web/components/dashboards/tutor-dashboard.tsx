import Link from "next/link";
import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";

import type { DashboardPanel } from "../../app/(app)/(dashboards)/_lib/catalog";
import { currentDashboardLocale } from "../../app/(app)/(dashboards)/_lib/locale";
import { loadTutorDashboardSummary } from "../../app/(app)/(dashboards)/_lib/summaries";
import { LessonCountdown } from "./lesson-countdown";
import { LessonFeedbackForm } from "./lesson-feedback-form";
import { learningBodyFont, learningDisplayFont } from "./learning-dashboard-fonts";
import styles from "./dashboard.module.css";

function ArrowIcon() {
  return <span aria-hidden="true">↗</span>;
}

export function TutorDashboardFallback() {
  return (
    <div className={styles.learningFallback} aria-busy="true" aria-label="Loading teaching desk">
      <div />
      <div />
      <span />
    </div>
  );
}

function money(amountMinor: number, currency: "USD" | "AMD", locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "AMD" ? 0 : 2,
  }).format(amountMinor / 100);
}

export async function TutorDashboard({
  panels,
  summary,
}: {
  panels: readonly DashboardPanel[];
  summary: ReactNode;
}) {
  const t = await getTranslations("dashboards.learning");
  const quickPanels = ["scheduling", "assignments", "communication", "payouts"]
    .map((module) => panels.find((panel) => panel.module === module))
    .filter((panel): panel is DashboardPanel => panel !== undefined);

  return (
    <div
      className={`${styles.learningShell} ${styles.tutorLearningShell} ${learningDisplayFont.variable} ${learningBodyFont.variable}`}
    >
      <header className={styles.learningHeader}>
        <div>
          <p className={styles.learningEyebrow}>{t("tutor.eyebrow")}</p>
          <h1>{t("tutor.title")}</h1>
          <p className={styles.learningIntro}>{t("tutor.intro")}</p>
        </div>
        <div className={styles.tutorMark} aria-hidden="true">
          <span>teach</span>
          <i>✓</i>
        </div>
      </header>

      {summary}

      <section className={styles.quickSection} aria-labelledby="tutor-quick-title">
        <div className={styles.sectionHeadingRow}>
          <div>
            <p className={styles.learningEyebrow}>{t("common.tools")}</p>
            <h2 id="tutor-quick-title">{t("tutor.quickTitle")}</h2>
          </div>
          <p>{t("tutor.quickIntro")}</p>
        </div>
        <div className={styles.quickLinks}>
          {quickPanels.map((panel) => (
            <Link href={panel.href} key={panel.id}>
              <span>{t(`modules.${panel.module}`)}</span>
              <ArrowIcon />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

export async function TutorDashboardSignals() {
  const [summary, locale, t] = await Promise.all([
    loadTutorDashboardSummary(),
    currentDashboardLocale(),
    getTranslations("dashboards.learning"),
  ]);
  const nextLesson = summary.nextLesson;
  const dateTime = (value: Date, timeZone: string) =>
    new Intl.DateTimeFormat(locale, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone,
    }).format(value);
  const expected =
    summary.expectedTotals.length > 0
      ? summary.expectedTotals
          .map((total) => money(total.amountMinor, total.currency, locale))
          .join(" · ")
      : t("common.noBalance");

  return (
    <>
      <section className={styles.tutorToday} aria-label={t("tutor.todayLabel")}>
        <article className={styles.nextTeachingCard}>
          <div className={styles.nextLessonTop}>
            <p>{t("tutor.nextClass")}</p>
            <span>{nextLesson ? t("common.scheduled") : t("common.clear")}</span>
          </div>
          {nextLesson ? (
            <>
              <strong>{dateTime(nextLesson.scheduledStartAt, nextLesson.timezoneAtBooking)}</strong>
              <p>{t("tutor.nextClassBody")}</p>
              <LessonCountdown
                startAt={nextLesson.scheduledStartAt.toISOString()}
                endAt={nextLesson.scheduledEndAt.toISOString()}
                joinUrl={summary.nextLessonJoinUrl}
                joinLabel={t("common.join")}
                locale={locale}
              />
              <Link href="/scheduling">
                {t("tutor.openLesson")} <ArrowIcon />
              </Link>
            </>
          ) : (
            <>
              <strong>{t("tutor.noUpcoming")}</strong>
              <p>{t("tutor.noUpcomingBody")}</p>
              <Link href="/scheduling">
                {t("tutor.viewCalendar")} <ArrowIcon />
              </Link>
            </>
          )}
        </article>

        <dl className={styles.tutorStats}>
          <div>
            <dt>{t("tutor.todayClasses")}</dt>
            <dd>{summary.todayLessonCount}</dd>
            <span>{t("tutor.todayClassesHint")}</span>
          </div>
          <div data-attention={summary.feedbackQueue.length > 0}>
            <dt>{t("tutor.recapsDue")}</dt>
            <dd>{summary.feedbackQueue.length}</dd>
            <span>{t("tutor.recapsDueHint")}</span>
          </div>
          <div>
            <dt>{t("tutor.weekClasses")}</dt>
            <dd>{summary.weekLessonCount}</dd>
            <span>{t("tutor.weekClassesHint")}</span>
          </div>
          <div>
            <dt>{t("tutor.expected")}</dt>
            <dd className={styles.moneyValue}>{expected}</dd>
            <span>{t("tutor.expectedHint")}</span>
          </div>
        </dl>
      </section>

      <section className={styles.recapQueue} aria-labelledby="recap-queue-title">
        <div className={styles.sectionHeadingRow}>
          <div>
            <p className={styles.learningEyebrow}>{t("tutor.closeLoop")}</p>
            <h2 id="recap-queue-title">{t("tutor.queueTitle")}</h2>
          </div>
          <p>{t("tutor.queueIntro")}</p>
        </div>

        {summary.feedbackQueue.length > 0 ? (
          <div className={styles.queueList}>
            {summary.feedbackQueue.map((item, index) => (
              <details className={styles.queueItem} key={item.lessonId} open={index === 0}>
                <summary>
                  <span className={styles.queueAvatar}>
                    {item.studentName.slice(0, 1).toUpperCase()}
                  </span>
                  <span className={styles.queueIdentity}>
                    <strong>{item.studentName}</strong>
                    <small>{dateTime(item.scheduledStartAt, item.timezoneAtBooking)}</small>
                  </span>
                  <span className={styles.queueStatus}>{t("tutor.feedbackNeeded")}</span>
                  <span className={styles.queueToggle} aria-hidden="true">
                    ＋
                  </span>
                </summary>
                <LessonFeedbackForm
                  lessonId={item.lessonId}
                  studentProfileId={item.studentProfileId}
                  studentName={item.studentName}
                />
              </details>
            ))}
          </div>
        ) : (
          <div className={styles.queueClear}>
            <span aria-hidden="true">✓</span>
            <div>
              <h3>{t("tutor.queueClearTitle")}</h3>
              <p>{t("tutor.queueClearBody")}</p>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
