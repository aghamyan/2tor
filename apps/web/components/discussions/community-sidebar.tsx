import Link from "next/link";
import { ArrowRight, CheckCircle2, MessageCircleQuestion, Sparkles } from "lucide-react";
import { getTranslations } from "next-intl/server";

import type { DiscussionFeedItem } from "../../../../packages/domain/discussions/models";
import { buildDiscussionsHref } from "./query-params";
import { hasTutorReviewSignal, needsTutorAttention } from "./question-state";
import styles from "./feed.module.css";

export async function CommunitySidebar({
  items,
  viewerKind,
  viewerUserId,
  basePath,
  currentParams,
}: {
  items: DiscussionFeedItem[];
  viewerKind: "student" | "tutor" | "staff";
  viewerUserId: string;
  basePath: string;
  currentParams: Record<string, string | undefined>;
}) {
  const t = await getTranslations("discussions.sidebar");
  const attentionCount = items.filter(needsTutorAttention).length;
  const ownItems = items.filter((item) => item.question.authorUserId === viewerUserId);
  const topicCounts = new Map<string, { name: string; count: number }>();
  for (const item of items) {
    for (const tag of item.tags) {
      const current = topicCounts.get(tag.slug);
      topicCounts.set(tag.slug, { name: tag.name, count: (current?.count ?? 0) + 1 });
    }
  }
  const popularTopics = [...topicCounts.entries()]
    .sort(
      (left, right) => right[1].count - left[1].count || left[1].name.localeCompare(right[1].name),
    )
    .slice(0, 5);

  return (
    <aside className={styles.sidebar} aria-label={t("label")}>
      <div className={styles.sidebarSticky}>
        {viewerKind === "student" ? (
          <section className={styles.sidebarPanel}>
            <div className={styles.panelHeading}>
              <Sparkles size={15} aria-hidden="true" />
              <h2>{t("yourActivity.title")}</h2>
            </div>
            <p className={styles.panelNote}>{t("currentView")}</p>
            <dl className={styles.sidebarStats}>
              <div>
                <dt>{t("yourActivity.questions")}</dt>
                <dd>{ownItems.length}</dd>
              </div>
              <div>
                <dt>{t("yourActivity.answered")}</dt>
                <dd>{ownItems.filter((item) => item.answerCount > 0).length}</dd>
              </div>
              <div>
                <dt>{t("yourActivity.reviewed")}</dt>
                <dd>{ownItems.filter(hasTutorReviewSignal).length}</dd>
              </div>
            </dl>
          </section>
        ) : (
          <section className={styles.sidebarPanel} data-emphasis={attentionCount > 0 || undefined}>
            <div className={styles.panelHeading}>
              <MessageCircleQuestion size={15} aria-hidden="true" />
              <h2>{t("attention.title")}</h2>
            </div>
            <strong className={styles.attentionNumber}>{attentionCount}</strong>
            <p>{t("attention.body", { count: attentionCount })}</p>
            <Link
              className={styles.panelLink}
              href={buildDiscussionsHref(basePath, currentParams, {
                tab: "needs-review",
                search: null,
                tag: null,
                grade: null,
                status: null,
                cursor: null,
              })}
            >
              {t("attention.action")} <ArrowRight size={13} aria-hidden="true" />
            </Link>
          </section>
        )}

        {popularTopics.length > 0 ? (
          <section className={styles.sidebarPanel}>
            <div className={styles.panelHeading}>
              <span className={styles.formulaGlyph} aria-hidden="true">
                π
              </span>
              <h2>{t("topics.title")}</h2>
            </div>
            <p className={styles.panelNote}>{t("currentView")}</p>
            <ul className={styles.topicList}>
              {popularTopics.map(([slug, topic]) => (
                <li key={slug}>
                  <Link
                    href={buildDiscussionsHref(basePath, currentParams, {
                      tag: slug,
                      cursor: null,
                    })}
                  >
                    <span>{topic.name}</span>
                    <strong>{topic.count}</strong>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className={styles.sidebarPanel}>
          <div className={styles.panelHeading}>
            <CheckCircle2 size={15} aria-hidden="true" />
            <h2>{t("guidelines.title")}</h2>
          </div>
          <ul className={styles.guidelineList}>
            <li>{t("guidelines.reasoning")}</li>
            <li>{t("guidelines.respect")}</li>
            <li>{t("guidelines.help")}</li>
          </ul>
        </section>
      </div>
    </aside>
  );
}
