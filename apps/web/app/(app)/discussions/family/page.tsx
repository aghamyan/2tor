import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { DiscussionShell } from "../../../../components/discussions/discussion-shell";
import { formatRelativeTime } from "../../../../components/discussions/format";
import { loadChildActivity, loadChildOptions, loadViewerContext } from "../queries";
import feedStyles from "../../../../components/discussions/feed.module.css";
import styles from "../../../../components/discussions/activity-page.module.css";

export const dynamic = "force-dynamic";

export default async function FamilyActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ child?: string }>;
}) {
  const viewer = await loadViewerContext();
  if (!viewer.isParentViewer) redirect("/discussions");

  const [{ child }, childOptions, t, locale] = await Promise.all([
    searchParams,
    loadChildOptions(),
    getTranslations("discussions"),
    getLocale(),
  ]);

  if (childOptions.length === 0) {
    return (
      <DiscussionShell activeTabId={null} tabs={[]} askHref={null}>
        <p className={styles.eyebrow}>{t("family.eyebrow")}</p>
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>{t("family.noChildren.title")}</p>
          <p>{t("family.noChildren.body")}</p>
        </div>
      </DiscussionShell>
    );
  }

  const selected = childOptions.find((option) => option.studentProfileId === child) ?? childOptions[0];
  if (!selected) redirect("/discussions");
  const summary = await loadChildActivity(selected.studentProfileId);

  return (
    <DiscussionShell activeTabId={null} tabs={[]} askHref={null}>
      <p className={styles.eyebrow}>{t("family.eyebrow")}</p>
      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.title}>{t("family.title", { name: selected.displayName })}</h1>
          <p className={styles.subtitle}>{t("family.subtitle")}</p>
        </div>
        {childOptions.length > 1 ? (
          <nav className={styles.picker} aria-label={t("family.childPickerLabel")}>
            <span className={styles.pickerLabel}>{t("family.childPickerLabel")}</span>
            {childOptions.map((option) => (
              <Link
                key={option.studentProfileId}
                href={`/discussions/family?child=${option.studentProfileId}`}
                className={styles.pickerLink}
                aria-current={option.studentProfileId === selected.studentProfileId ? "true" : undefined}
              >
                {option.displayName}
              </Link>
            ))}
          </nav>
        ) : null}
      </div>

      {!summary ? (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>{t("family.noChildren.title")}</p>
          <p>{t("family.noChildren.body")}</p>
        </div>
      ) : (
        <>
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <span className={styles.statValue}>{summary.questionsAskedThisMonth}</span>
              <span className={styles.statLabel}>{t("family.stats.questionsAsked")}</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statValue}>{summary.answersSubmittedThisMonth}</span>
              <span className={styles.statLabel}>{t("family.stats.answersSubmitted")}</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statValue}>{summary.acceptedAnswers}</span>
              <span className={styles.statLabel}>{t("family.stats.acceptedAnswers")}</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statValue}>{summary.tutorVerifiedAnswers}</span>
              <span className={styles.statLabel}>{t("family.stats.tutorVerifiedAnswers")}</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statValue}>
                {summary.averageRatingOnRecentAnswers?.toFixed(1) ?? "—"}
              </span>
              <span className={styles.statLabel}>
                {summary.averageRatingOnRecentAnswers === null
                  ? t("family.stats.noRatingYet")
                  : t("family.stats.averageRating")}
              </span>
            </div>
          </div>

          <section className={styles.section}>
            <h2 className={styles.sectionHeading}>
              {t("family.unresolvedHeading", { count: summary.unresolvedQuestions.length })}
            </h2>
            {summary.unresolvedQuestions.length > 0 ? (
              <ul className={styles.list}>
                {summary.unresolvedQuestions.map((question) => (
                  <li key={question.id} className={styles.listItem}>
                    <div className={styles.itemTop}>
                      <Link href={`/discussions/${question.slug}`} className={styles.itemTitle}>
                        {question.title}
                      </Link>
                      <span className={feedStyles.badge} data-tone="amber">
                        {t(`status.${question.status}` as never)}
                      </span>
                    </div>
                    <p className={styles.itemMeta}>
                      <time dateTime={question.createdAt.toISOString()}>
                        {formatRelativeTime(question.createdAt, locale)}
                      </time>
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.itemMeta}>{t("family.unresolvedEmpty")}</p>
            )}
          </section>

          {summary.topicsRequiringSupport.length > 0 ? (
            <section className={styles.section}>
              <h2 className={styles.sectionHeading}>{t("family.topicsHeading")}</h2>
              <div className={styles.tagChips}>
                {summary.topicsRequiringSupport.map((topic) => (
                  <span key={topic} className={styles.tagChip}>
                    {topic}
                  </span>
                ))}
              </div>
            </section>
          ) : null}

          <section className={styles.section}>
            <h2 className={styles.sectionHeading}>{t("family.feedbackHeading")}</h2>
            {summary.recentTutorFeedback.length > 0 ? (
              <ul className={styles.list}>
                {summary.recentTutorFeedback.map((feedback) => (
                  <li key={feedback.answerId} className={styles.listItem}>
                    <div className={styles.itemTop}>
                      <Link href={`/discussions/${feedback.questionSlug}`} className={styles.itemTitle}>
                        {feedback.questionTitle}
                      </Link>
                      <span className={feedStyles.badge} data-tone="green">
                        {t(`verification.${feedback.verificationStatus}` as never)}
                      </span>
                    </div>
                    {feedback.verificationNote ? <p className={styles.itemNote}>{feedback.verificationNote}</p> : null}
                    {feedback.verifiedAt ? (
                      <p className={styles.itemMeta}>
                        <time dateTime={feedback.verifiedAt.toISOString()}>
                          {formatRelativeTime(feedback.verifiedAt, locale)}
                        </time>
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.itemMeta}>{t("family.feedbackEmpty")}</p>
            )}
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionHeading}>{t("family.activityHeading")}</h2>
            {summary.recentActivity.length > 0 ? (
              <ul className={styles.list}>
                {summary.recentActivity.map((entry, index) => {
                  const label =
                    entry.kind === "question_asked"
                      ? t("family.activityKind.question_asked", { title: entry.questionTitle })
                      : entry.kind === "answer_submitted"
                        ? t("family.activityKind.answer_submitted", { title: entry.questionTitle })
                        : entry.kind === "answer_accepted"
                          ? t("family.activityKind.answer_accepted", { title: entry.questionTitle })
                          : t("family.activityKind.answer_tutor_verified", { title: entry.questionTitle });
                  return (
                    <li key={`${entry.kind}-${entry.questionId}-${index}`} className={styles.listItem}>
                      <div className={styles.itemTop}>
                        <Link href={`/discussions/${entry.questionSlug}`} className={styles.itemTitle}>
                          {label}
                        </Link>
                      </div>
                      <p className={styles.itemMeta}>
                        <time dateTime={entry.at.toISOString()}>{formatRelativeTime(entry.at, locale)}</time>
                      </p>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className={styles.itemMeta}>{t("family.activityEmpty")}</p>
            )}
          </section>
        </>
      )}
    </DiscussionShell>
  );
}
