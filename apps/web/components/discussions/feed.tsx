import { getTranslations } from "next-intl/server";
import Link from "next/link";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  MessageCircleQuestion,
  SearchX,
} from "lucide-react";

import type {
  DiscussionFeedPage,
  DiscussionTagRecord,
} from "../../../../packages/domain/discussions/models";
import { FeedControls } from "./feed-controls";
import { QuestionCard } from "./question-card";
import { CommunitySidebar } from "./community-sidebar";
import { needsTutorAttention } from "./question-state";
import { buildDiscussionsHref } from "./query-params";
import styles from "./feed.module.css";

export async function Feed({
  page,
  tags,
  basePath,
  tab,
  search,
  sort,
  tagSlug,
  grade,
  status,
  offset,
  limit,
  currentParams,
  viewerKind,
  viewerUserId,
  canAsk,
}: {
  page: DiscussionFeedPage;
  tags: DiscussionTagRecord[];
  basePath: string;
  tab: string | null;
  search: string;
  sort: string;
  tagSlug: string;
  grade: string;
  status: string;
  offset: number;
  limit: number;
  currentParams: Record<string, string | undefined>;
  viewerKind: "student" | "tutor" | "staff";
  viewerUserId: string;
  canAsk: boolean;
}) {
  const t = await getTranslations("discussions");
  const authorName = currentParams.author ? (currentParams.authorName ?? null) : null;
  const hasActiveFilters = Boolean(search || tagSlug || grade || status || authorName);
  const showTutorPriority =
    viewerKind !== "student" && (!tab || tab === "all") && !hasActiveFilters && offset === 0;
  const priorityItems = showTutorPriority ? page.items.filter(needsTutorAttention).slice(0, 3) : [];
  const priorityIds = new Set(priorityItems.map((item) => item.question.id));
  const communityItems = showTutorPriority
    ? page.items.filter((item) => !priorityIds.has(item.question.id))
    : page.items;
  const clearHref = buildDiscussionsHref(basePath, currentParams, {
    search: null,
    tag: null,
    grade: null,
    status: null,
    author: null,
    authorName: null,
    cursor: null,
  });

  return (
    <div className={styles.feedSurface}>
      <FeedControls
        basePath={basePath}
        tab={tab}
        search={search}
        sort={sort}
        tagSlug={tagSlug}
        grade={grade}
        status={status}
        authorId={currentParams.author}
        authorName={authorName ?? undefined}
        tags={tags}
      />
      <div className={styles.feedLayout}>
        <section className={styles.feedColumn} aria-labelledby="question-feed-heading">
          <div className={styles.resultBar}>
            <h2 id="question-feed-heading">{t("feed.heading")}</h2>
            <span>{t("feed.resultCount", { count: page.items.length })}</span>
          </div>

          {priorityItems.length > 0 ? (
            <section className={styles.attentionPanel} aria-labelledby="attention-heading">
              <div className={styles.sectionHeading}>
                <div>
                  <p>{t("feed.attention.eyebrow")}</p>
                  <h2 id="attention-heading">{t("feed.attention.title")}</h2>
                  <span>{t("feed.attention.body", { count: priorityItems.length })}</span>
                </div>
                <Link
                  href={buildDiscussionsHref(basePath, currentParams, {
                    tab: "needs-review",
                    cursor: null,
                  })}
                >
                  {t("feed.attention.action")} <ArrowRight size={13} aria-hidden="true" />
                </Link>
              </div>
              <ul className={styles.list}>
                {priorityItems.map((item) => (
                  <QuestionCard
                    key={item.question.id}
                    item={item}
                    basePath={basePath}
                    currentParams={currentParams}
                    priority
                  />
                ))}
              </ul>
            </section>
          ) : null}

          {priorityItems.length > 0 && communityItems.length > 0 ? (
            <div className={styles.communityHeading}>
              <h2>{t("feed.communityHeading")}</h2>
            </div>
          ) : null}

          {page.items.length === 0 ? (
            <div className={styles.emptyState}>
              {hasActiveFilters ? (
                <SearchX size={28} aria-hidden="true" />
              ) : (
                <MessageCircleQuestion size={28} aria-hidden="true" />
              )}
              <h2>{t(hasActiveFilters ? "feed.emptyFiltered.title" : "feed.empty.title")}</h2>
              <p>{t(hasActiveFilters ? "feed.emptyFiltered.body" : "feed.empty.body")}</p>
              {hasActiveFilters ? (
                <Link href={clearHref} className={styles.emptyAction}>
                  {t("feed.clearFilters")}
                </Link>
              ) : canAsk ? (
                <Link href="/discussions/ask" className={styles.emptyAction}>
                  {t("shell.askButton")}
                </Link>
              ) : null}
            </div>
          ) : communityItems.length > 0 ? (
            <ul className={styles.list}>
              {communityItems.map((item) => (
                <QuestionCard
                  key={item.question.id}
                  item={item}
                  basePath={basePath}
                  currentParams={currentParams}
                />
              ))}
            </ul>
          ) : null}

          {offset > 0 || page.nextCursor ? (
            <nav className={styles.pagination} aria-label={t("feed.paginationLabel")}>
              {offset > 0 ? (
                <Link
                  className={styles.pageLink}
                  href={buildDiscussionsHref(basePath, currentParams, {
                    cursor: String(Math.max(0, offset - limit)),
                  })}
                >
                  <ChevronLeft size={15} aria-hidden="true" /> {t("feed.previous")}
                </Link>
              ) : null}
              {page.nextCursor ? (
                <Link
                  className={styles.pageLink}
                  href={buildDiscussionsHref(basePath, currentParams, { cursor: page.nextCursor })}
                >
                  {t("feed.loadMore")} <ChevronRight size={15} aria-hidden="true" />
                </Link>
              ) : null}
            </nav>
          ) : null}
        </section>
        <CommunitySidebar
          items={page.items}
          viewerKind={viewerKind}
          viewerUserId={viewerUserId}
          basePath={basePath}
          currentParams={currentParams}
        />
      </div>
    </div>
  );
}
