import Link from "next/link";
import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";

import type { DashboardPanel } from "../../app/(app)/(dashboards)/_lib/catalog";
import { currentDashboardLocale } from "../../app/(app)/(dashboards)/_lib/locale";
import { loadParentDashboardSummary } from "../../app/(app)/(dashboards)/_lib/summaries";
import { LessonCountdown } from "./lesson-countdown";
import { learningBodyFont, learningDisplayFont } from "./learning-dashboard-fonts";
import styles from "./dashboard.module.css";

function ArrowIcon() {
  return <span aria-hidden="true">↗</span>;
}

export function ParentDashboardFallback() {
  return (
    <div className={styles.learningFallback} aria-busy="true" aria-label="Loading learning story">
      <div />
      <div />
      <span />
    </div>
  );
}

export async function ParentDashboard({
  panels,
  summary,
}: {
  panels: readonly DashboardPanel[];
  summary: ReactNode;
}) {
  const t = await getTranslations("dashboards.learning");
  const quickPanels = ["scheduling", "communication", "assignments", "payments"]
    .map((module) => panels.find((panel) => panel.module === module))
    .filter((panel): panel is DashboardPanel => panel !== undefined);

  return (
    <div
      className={`${styles.learningShell} ${learningDisplayFont.variable} ${learningBodyFont.variable}`}
    >
      <header className={styles.learningHeader}>
        <div>
          <p className={styles.learningEyebrow}>{t("parent.eyebrow")}</p>
          <h1>{t("parent.title")}</h1>
          <p className={styles.learningIntro}>{t("parent.intro")}</p>
        </div>
        <div className={styles.parentMark} aria-hidden="true">
          <span>2tor</span>
          <i>♥</i>
        </div>
      </header>

      {summary}

      <section className={styles.quickSection} aria-labelledby="parent-quick-title">
        <div className={styles.sectionHeadingRow}>
          <div>
            <p className={styles.learningEyebrow}>{t("common.tools")}</p>
            <h2 id="parent-quick-title">{t("parent.quickTitle")}</h2>
          </div>
          <p>{t("parent.quickIntro")}</p>
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

export async function ParentDashboardSignals() {
  const [summary, locale, t] = await Promise.all([
    loadParentDashboardSummary(),
    currentDashboardLocale(),
    getTranslations("dashboards.learning"),
  ]);
  const nextLesson = summary.nextLesson;
  const date = (value: Date) =>
    new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(value);
  const dateTime = (value: Date, timeZone: string) =>
    new Intl.DateTimeFormat(locale, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone,
    }).format(value);

  if (summary.children.length === 0) {
    return (
      <section className={styles.emptyLearningState}>
        <span aria-hidden="true">＋</span>
        <h2>{t("parent.emptyTitle")}</h2>
        <p>{t("parent.emptyBody")}</p>
        <Link href="/families/new">{t("parent.addChild")}</Link>
      </section>
    );
  }

  return (
    <>
      <section className={styles.parentOverview} aria-label={t("parent.overviewLabel")}>
        <div className={styles.childCard}>
          <div className={styles.childIdentity}>
            <span className={styles.childAvatar} aria-hidden="true">
              {summary.children[0]?.preferredName.slice(0, 1).toUpperCase()}
            </span>
            <div>
              <p>{t("parent.learningNow")}</p>
              <h2>{summary.children[0]?.preferredName}</h2>
              <span>{summary.children[0]?.gradeLevel ?? t("parent.gradeNotSet")}</span>
            </div>
          </div>
          {summary.children.length > 1 ? (
            <div className={styles.childSwitcher}>
              {summary.children.map((child) => (
                <a href={`#child-${child.id}`} key={child.id}>
                  {child.preferredName}
                </a>
              ))}
            </div>
          ) : null}
          <dl className={styles.childStats}>
            <div>
              <dt>{t("parent.classesFinished")}</dt>
              <dd>{summary.completedLessonCount}</dd>
            </div>
            <div>
              <dt>{t("parent.tutorRecaps")}</dt>
              <dd>{summary.children.reduce((count, child) => count + child.feedback.length, 0)}</dd>
            </div>
            <div>
              <dt>{t("parent.needsAttention")}</dt>
              <dd>{summary.actionCount}</dd>
            </div>
          </dl>
        </div>

        <aside className={styles.nextLessonCard}>
          <div className={styles.nextLessonTop}>
            <p>{t("parent.upNext")}</p>
            <span>{nextLesson ? t("common.scheduled") : t("common.clear")}</span>
          </div>
          {nextLesson ? (
            <>
              <strong>{dateTime(nextLesson.scheduledStartAt, nextLesson.timezoneAtBooking)}</strong>
              <p>{t("parent.nextLessonBody")}</p>
              <LessonCountdown
                startAt={nextLesson.scheduledStartAt.toISOString()}
                endAt={nextLesson.scheduledEndAt.toISOString()}
                joinUrl={summary.nextLessonJoinUrl}
                joinLabel={t("common.join")}
                locale={locale}
              />
              <Link href="/scheduling">
                {t("parent.viewSchedule")} <ArrowIcon />
              </Link>
            </>
          ) : (
            <>
              <strong>{t("parent.noLesson")}</strong>
              <p>{t("parent.noLessonBody")}</p>
              <Link href="/scheduling">
                {t("parent.openSchedule")} <ArrowIcon />
              </Link>
            </>
          )}
        </aside>
      </section>

      {summary.children.map((child) => (
        <section className={styles.learningStory} id={`child-${child.id}`} key={child.id}>
          <div className={styles.sectionHeadingRow}>
            <div>
              <p className={styles.learningEyebrow}>{t("parent.recentLearning")}</p>
              <h2>{t("parent.storyTitle", { name: child.preferredName })}</h2>
            </div>
            <Link href="/academics">
              {t("parent.allProgress")} <ArrowIcon />
            </Link>
          </div>

          {child.feedback.length > 0 ? (
            <div className={styles.lessonTimeline}>
              {child.feedback.map((feedback, index) => (
                <article className={styles.lessonRecap} key={feedback.id}>
                  <div className={styles.timelineRail}>
                    <span>{index === 0 ? "●" : "○"}</span>
                  </div>
                  <div className={styles.recapContent}>
                    <div className={styles.recapMeta}>
                      <time dateTime={feedback.createdAt.toISOString()}>
                        {date(feedback.createdAt)}
                      </time>
                      <span data-outcome={feedback.objectiveMet}>
                        {feedback.objectiveMet === "yes"
                          ? t("common.goalMet")
                          : feedback.objectiveMet === "partly"
                            ? t("common.inProgress")
                            : t("common.needsPractice")}
                      </span>
                    </div>
                    <h3>{feedback.topicsCovered}</h3>
                    <blockquote>“{feedback.freeTextComment}”</blockquote>
                    <div className={styles.recapDetails}>
                      <div>
                        <span>✦</span>
                        <p>
                          <strong>{t("parent.strength")}</strong>
                          {feedback.strengthsDemonstrated}
                        </p>
                      </div>
                      <div>
                        <span>→</span>
                        <p>
                          <strong>{t("parent.nextFocus")}</strong>
                          {feedback.nextLessonFocus}
                        </p>
                      </div>
                    </div>
                    {feedback.assignedHomework !== t("common.none") ? (
                      <p className={styles.homeworkNote}>
                        <span>{t("parent.practice")}</span>
                        {feedback.assignedHomework}
                      </p>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className={styles.noRecaps}>
              <span aria-hidden="true">◌</span>
              <h3>{t("parent.noRecapsTitle")}</h3>
              <p>{t("parent.noRecapsBody")}</p>
            </div>
          )}
        </section>
      ))}
    </>
  );
}
