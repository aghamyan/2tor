import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowLeft, Eye, MessageCircle } from "lucide-react";

import { communityName } from "../../../../../../packages/domain/discussions/branding";
import { DiscussionMarkdown } from "../../../../components/discussions/markdown";
import { AnswerCard } from "../../../../components/discussions/answer-card";
import { AnswerForm } from "../../../../components/discussions/answer-form";
import { AttachmentList } from "../../../../components/discussions/attachment-list";
import { AttachmentUploadForm } from "../../../../components/discussions/attachment-upload-form";
import { CommentList } from "../../../../components/discussions/comment-list";
import { SimpleActionButton } from "../../../../components/discussions/simple-action-button";
import { formatRelativeTime } from "../../../../components/discussions/format";
import { followQuestionAction, saveQuestionAction } from "../actions";
import { loadQuestionDetailBySlug } from "../queries";
import type { RatingBreakdown } from "../../../../../../packages/domain/discussions/ratings";
import feedStyles from "../../../../components/discussions/feed.module.css";
import styles from "../../../../components/discussions/question-detail.module.css";

export const dynamic = "force-dynamic";

/** `data.ratingsByAnswer` is built from the same `answers` array being mapped below, so every
 *  answer.id is always present — this fallback only guards the type, never actually renders. */
const EMPTY_RATING_BREAKDOWN: RatingBreakdown = { average: null, count: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }, ratings: [] };

const STATUS_TONE: Record<string, "primary" | "green" | "amber" | "muted"> = {
  open: "primary",
  answered: "primary",
  accepted: "green",
  tutor_verified: "green",
  needs_tutor_review: "amber",
  needs_clarification: "amber",
  closed: "muted",
  locked: "muted",
  duplicate: "muted",
  resolved: "green",
  pending_moderation: "amber",
};

export default async function QuestionDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await loadQuestionDetailBySlug(slug);
  if (!data) notFound();

  const [t, locale] = await Promise.all([getTranslations("discussions"), getLocale()]);
  const { question } = data;

  const canAccept =
    !data.viewerIsStaff &&
    !data.viewerIsTutor &&
    data.viewerUserId === question.authorUserId &&
    question.status !== "locked";
  const canAnswer = question.status !== "locked" && question.status !== "closed" && question.status !== "duplicate";
  const canRateAnswers = (data.viewerIsTutor || data.viewerIsStaff) && question.status !== "locked";

  return (
    <div className={styles.page}>
      <Link href="/discussions" className={styles.backLink}>
        <ArrowLeft size={14} aria-hidden="true" /> {t("detail.backToFeed")}
      </Link>

      <header className={styles.questionHeader}>
        <div className={styles.badgeRow}>
          <span className={feedStyles.badge} data-tone={STATUS_TONE[question.status] ?? "muted"}>
            {t(`status.${question.status}` as never)}
          </span>
          {question.visibility !== "community" ? (
            <span className={feedStyles.badge} data-tone="muted">
              {t(`visibility.${question.visibility}` as never)}
            </span>
          ) : null}
        </div>
        <h1 className={styles.title}>{question.title}</h1>
        <div className={styles.questionMeta}>
          <span>{t("card.askedBy", { name: question.authorDisplayName })}</span>
          {question.gradeLevel ? (
            <span className={styles.gradeBadge}>
              {question.gradeLevel === "College"
                ? t("feed.gradeCollege")
                : t("card.gradeLevel", { grade: question.gradeLevel })}
            </span>
          ) : null}
          <span>
            <time dateTime={question.createdAt.toISOString()}>{formatRelativeTime(question.createdAt, locale)}</time>
          </span>
          <span>
            <Eye size={13} aria-hidden="true" /> {t("card.views", { count: question.viewCount })}
          </span>
          <span>
            <MessageCircle size={13} aria-hidden="true" /> {t("detail.answersHeading", { count: data.answers.length })}
          </span>
        </div>
        {data.tags.length > 0 ? (
          <div className={styles.questionTags}>
            {data.tags.map((tag) => (
              <span key={tag.id} className={styles.tagChip}>
                {tag.name}
              </span>
            ))}
          </div>
        ) : null}
      </header>

      <div className={styles.questionBody}>
        <DiscussionMarkdown body={question.body} />
      </div>

      <AttachmentList attachments={data.attachments} />
      {data.canUploadAttachment ? (
        <div className={styles.attachmentUpload}>
          <AttachmentUploadForm questionId={question.id} />
        </div>
      ) : null}

      <div className={styles.questionActions}>
        <SimpleActionButton
          action={followQuestionAction.bind(null, question.id, !data.isFollowing)}
          label={data.isFollowing ? t("detail.followingButton") : t("detail.followButton")}
          className={styles.toggleButton}
          showFeedback={false}
        />
        <SimpleActionButton
          action={saveQuestionAction.bind(null, question.id, !data.isSaved)}
          label={data.isSaved ? t("detail.savedButton") : t("detail.saveButton")}
          className={styles.toggleButton}
          showFeedback={false}
        />
      </div>

      <CommentList
        questionId={question.id}
        comments={data.commentsByQuestion}
        target={{ questionId: question.id }}
        locale={locale}
        canComment
      />

      <h2 className={styles.answersHeading}>{t("detail.answersHeading", { count: data.answers.length })}</h2>
      {data.orderedAnswers.length > 0 ? (
        <ul className={styles.answerList}>
          {data.orderedAnswers.map((answer, index) => (
            <AnswerCard
              key={answer.id}
              answer={answer}
              questionId={question.id}
              rank={index + 1}
              ratingBreakdown={data.ratingsByAnswer.get(answer.id) ?? EMPTY_RATING_BREAKDOWN}
              myRating={data.myRatingByAnswer.get(answer.id) ?? null}
              comments={data.commentsByAnswer.get(answer.id) ?? []}
              corrections={data.correctionsByAnswer.get(answer.id) ?? []}
              helpfulCount={data.helpfulCounts.get(answer.id) ?? 0}
              locale={locale}
              viewerUserId={data.viewerUserId}
              canAccept={canAccept}
              canRate={canRateAnswers && answer.authorUserId !== data.viewerUserId && !answer.isTutorAnswer}
              canComment
            />
          ))}
        </ul>
      ) : (
        <p className={styles.emptyAnswers}>{t("detail.answersHeading", { count: 0 })}</p>
      )}

      {canAnswer ? (
        <AnswerForm questionId={question.id} />
      ) : (
        <p className={styles.emptyAnswers}>
          {question.status === "locked" ? t("detail.cannotAnswerLocked") : t("detail.cannotAnswerClosed")}
        </p>
      )}
    </div>
  );
}

export function generateMetadata() {
  return { title: communityName, robots: { index: false, follow: false, nocache: true } };
}
