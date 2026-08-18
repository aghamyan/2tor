import { getTranslations } from "next-intl/server";
import { CheckCircle2, GraduationCap, ThumbsUp } from "lucide-react";

import type {
  DiscussionAnswerRecord,
  DiscussionAnswerTutorRatingRecord,
  DiscussionCommentRecord,
  DiscussionCorrectionRecord,
} from "../../../../packages/domain/discussions/models";
import type { RatingBreakdown } from "../../../../packages/domain/discussions/ratings";
import { acceptAnswerAction, castHelpfulVoteAction } from "../../app/(app)/discussions/actions";
import { DiscussionMarkdown } from "./markdown";
import { CommentList } from "./comment-list";
import { SimpleActionButton } from "./simple-action-button";
import { RatingDialog } from "./rating-dialog";
import { RatingBreakdownPanel } from "./rating-breakdown";
import { formatRelativeTime } from "./format";
import styles from "./question-detail.module.css";

export async function AnswerCard({
  answer,
  questionId,
  rank,
  ratingBreakdown,
  myRating,
  comments,
  corrections,
  helpfulCount,
  locale,
  viewerUserId,
  canAccept,
  canRate,
  canComment,
}: {
  answer: DiscussionAnswerRecord;
  questionId: string;
  rank: number;
  ratingBreakdown: RatingBreakdown;
  myRating: DiscussionAnswerTutorRatingRecord | null;
  comments: DiscussionCommentRecord[];
  corrections: DiscussionCorrectionRecord[];
  helpfulCount: number;
  locale: string;
  viewerUserId: string;
  canAccept: boolean;
  canRate: boolean;
  canComment: boolean;
}) {
  const t = await getTranslations("discussions");
  const isOwnAnswer = answer.authorUserId === viewerUserId;

  return (
    <li
      id={`answer-${answer.id}`}
      className={styles.answer}
      data-accepted={answer.isAccepted || undefined}
    >
      <div className={styles.answerTop}>
        <div className={styles.answerBadges}>
          {answer.isAccepted ? (
            <span className={styles.badgeGreen}>
              <CheckCircle2 size={13} aria-hidden="true" /> {t("detail.accepted")}
            </span>
          ) : null}
          {answer.isTutorAnswer ? (
            <span className={styles.badgePrimary}>
              <GraduationCap size={13} aria-hidden="true" /> {t("detail.tutorAnswerBadge")}
            </span>
          ) : null}
          {answer.verificationStatus !== "unverified" ? (
            <span className={styles.badgeGreen}>
              <CheckCircle2 size={13} aria-hidden="true" />{" "}
              {t(`verification.${answer.verificationStatus}` as never)}
            </span>
          ) : null}
        </div>
        <span className={styles.answerMeta}>
          {answer.authorDisplayName} ·{" "}
          <time dateTime={answer.createdAt.toISOString()}>
            {formatRelativeTime(answer.createdAt, locale)}
          </time>
        </span>
      </div>

      {answer.verificationNote ? (
        <p className={styles.verificationNote}>{answer.verificationNote}</p>
      ) : null}

      <DiscussionMarkdown body={answer.body} />

      {!answer.isTutorAnswer ? (
        <div className={styles.ratingSummary}>
          {ratingBreakdown.count > 0 ? (
            <RatingBreakdownPanel breakdown={ratingBreakdown} locale={locale} />
          ) : (
            <span>{t("detail.notYetRated")}</span>
          )}
          {canRate ? (
            <RatingDialog answerId={answer.id} questionId={questionId} existingRating={myRating} />
          ) : null}
        </div>
      ) : null}

      {corrections.length > 0 ? (
        <div className={styles.corrections}>
          <p className={styles.commentsHeading}>
            {t("detail.correctionsHeading", { count: corrections.length })}
          </p>
          <ul className={styles.correctionList}>
            {corrections.map((correction) => (
              <li key={correction.id} className={styles.correction}>
                <p className={styles.correctionMeta}>
                  {correction.proposedByDisplayName} ·{" "}
                  {t(`detail.correctionStatus.${correction.status}` as never)}
                </p>
                <p>
                  <strong>{correction.issueDescription}</strong>
                </p>
                <p>{correction.proposedCorrection}</p>
                {correction.authorResponse ? (
                  <p className={styles.correctionResponse}>{correction.authorResponse}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className={styles.answerActions}>
        {!isOwnAnswer ? (
          <SimpleActionButton
            action={castHelpfulVoteAction.bind(null, answer.id, questionId)}
            label={
              helpfulCount > 0
                ? t("detail.helpfulCount", { count: helpfulCount })
                : t("detail.helpfulButton")
            }
            className={styles.helpfulButton}
            showFeedback={false}
          />
        ) : helpfulCount > 0 ? (
          <span className={styles.helpfulCountLabel}>
            <ThumbsUp size={13} aria-hidden="true" />{" "}
            {t("detail.helpfulCount", { count: helpfulCount })}
          </span>
        ) : null}
        {canAccept && !answer.isAccepted ? (
          <SimpleActionButton
            action={acceptAnswerAction.bind(null, answer.id, questionId)}
            label={t("detail.acceptButton")}
            className={styles.acceptButton}
          />
        ) : null}
      </div>

      <CommentList
        questionId={questionId}
        comments={comments}
        target={{ answerId: answer.id }}
        locale={locale}
        canComment={canComment}
      />
    </li>
  );
}
