import Link from "next/link";
import {
  CheckCircle2,
  Clock3,
  Copy,
  Eye,
  Lock,
  MessageCircle,
  MessagesSquare,
  ShieldCheck,
  Star,
} from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import type { DiscussionFeedItem } from "../../../../packages/domain/discussions/models";
import { formatRelativeTime, previewText } from "./format";
import { buildDiscussionsHref } from "./query-params";
import { questionState, type QuestionState } from "./question-state";
import styles from "./feed.module.css";

type StatusTone = "attention" | "discussion" | "verified" | "primary" | "muted";

const STATUS_TONE: Partial<Record<QuestionState, StatusTone>> = {
  needs_answer: "attention",
  needs_tutor_review: "attention",
  needs_clarification: "attention",
  pending_moderation: "attention",
  student_discussion: "discussion",
  tutor_replied: "primary",
  tutor_verified: "verified",
  accepted: "verified",
  resolved: "verified",
  closed: "muted",
  locked: "muted",
  duplicate: "muted",
};

const STATUS_ICON: Partial<Record<QuestionState, typeof CheckCircle2>> = {
  needs_answer: Clock3,
  needs_tutor_review: Clock3,
  needs_clarification: Clock3,
  pending_moderation: Clock3,
  student_discussion: MessagesSquare,
  tutor_replied: ShieldCheck,
  tutor_verified: ShieldCheck,
  accepted: CheckCircle2,
  resolved: CheckCircle2,
  locked: Lock,
  duplicate: Copy,
};

function statusTranslationKey(state: QuestionState): string {
  if (state === "needs_answer" || state === "student_discussion" || state === "tutor_replied") {
    return `cardState.${state}`;
  }
  return `status.${state}`;
}

export async function QuestionCard({
  item,
  basePath,
  currentParams,
  priority = false,
}: {
  item: DiscussionFeedItem;
  basePath: string;
  currentParams: Record<string, string | undefined>;
  priority?: boolean;
}) {
  const t = await getTranslations("discussions");
  const locale = await getLocale();
  const { question } = item;
  const state = questionState(item);
  const tone = STATUS_TONE[state] ?? "primary";
  const StatusIcon = STATUS_ICON[state];
  const authorFilterHref = buildDiscussionsHref(basePath, currentParams, {
    author: question.authorUserId,
    authorName: question.authorDisplayName,
    cursor: null,
  });
  const visibleTags = item.tags.slice(0, 3);
  const remainingTagCount = Math.max(0, item.tags.length - visibleTags.length);
  const authorInitial =
    question.authorDisplayName.trim().slice(0, 1).toLocaleUpperCase(locale) || "?";

  return (
    <li>
      <article className={styles.card} data-tone={tone} data-priority={priority || undefined}>
        <aside className={styles.metricRail} aria-label={t("card.activityLabel")}>
          <span className={styles.railMarker} aria-hidden="true" />
          <span title={t("card.answers", { count: item.answerCount })}>
            <MessageCircle size={14} aria-hidden="true" />
            <strong>{item.answerCount}</strong>
            <small>{t("card.answersShort")}</small>
          </span>
          <span title={t("card.comments", { count: item.commentCount })}>
            <MessagesSquare size={14} aria-hidden="true" />
            <strong>{item.commentCount}</strong>
            <small>{t("card.commentsShort")}</small>
          </span>
          <span title={t("card.views", { count: question.viewCount })}>
            <Eye size={14} aria-hidden="true" />
            <strong>{question.viewCount}</strong>
            <small>{t("card.viewsShort")}</small>
          </span>
        </aside>

        <div className={styles.cardContent}>
          <div className={styles.cardTop}>
            <span className={styles.statusLabel} data-tone={tone}>
              {StatusIcon ? <StatusIcon size={13} aria-hidden="true" /> : null}
              {t(statusTranslationKey(state) as never)}
            </span>
            {question.visibility !== "community" ? (
              <span
                className={styles.visibilityLabel}
                title={t(`visibility.${question.visibility}` as never)}
              >
                <Lock size={12} aria-hidden="true" />
                {t(`visibilityShort.${question.visibility}` as never)}
              </span>
            ) : null}
          </div>

          <h2 className={styles.cardTitle}>
            <Link href={`/discussions/${question.slug}`} className={styles.cardTitleLink}>
              {question.title}
            </Link>
          </h2>
          <p className={styles.cardSnippet}>{previewText(question.body, 190)}</p>

          <div className={styles.topicRow}>
            {visibleTags.map((tag) => (
              <span key={tag.id} className={styles.tagChip}>
                {tag.name}
              </span>
            ))}
            {remainingTagCount > 0 ? (
              <span className={styles.moreTags}>+{remainingTagCount}</span>
            ) : null}
            {question.gradeLevel ? (
              <span className={styles.gradeBadge}>
                {question.gradeLevel === "College"
                  ? t("feed.gradeCollege")
                  : t("card.gradeLevel", { grade: question.gradeLevel })}
              </span>
            ) : null}
          </div>

          <footer className={styles.cardFooter}>
            <div className={styles.authorBlock}>
              <span className={styles.avatar} aria-hidden="true">
                {authorInitial}
              </span>
              <span>
                <Link href={authorFilterHref} className={styles.authorLink}>
                  {question.authorDisplayName}
                </Link>
                <small>
                  {t("card.student")} · {formatRelativeTime(question.lastActivityAt, locale)}
                </small>
              </span>
            </div>
            {item.topTutorRatingAverage !== null ? (
              <span className={styles.ratingSignal}>
                <Star size={13} fill="currentColor" aria-hidden="true" />
                {t("card.tutorRating", {
                  average: item.topTutorRatingAverage.toFixed(1),
                  count: item.topTutorRatingCount,
                })}
              </span>
            ) : item.helpfulCount > 0 ? (
              <span className={styles.helpfulSignal}>
                {t("card.helpful", { count: item.helpfulCount })}
              </span>
            ) : null}
          </footer>
        </div>
      </article>
    </li>
  );
}
