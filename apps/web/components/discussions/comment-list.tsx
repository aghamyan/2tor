"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import type { DiscussionCommentRecord } from "../../../../packages/domain/discussions/models";
import { CommentForm, type CommentTarget } from "./comment-form";
import { formatRelativeTime } from "./format";
import styles from "./question-detail.module.css";

export function CommentList({
  questionId,
  comments,
  target,
  locale,
  canComment,
}: {
  questionId: string;
  comments: DiscussionCommentRecord[];
  target: CommentTarget;
  locale: string;
  canComment: boolean;
}) {
  const t = useTranslations("discussions");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const topLevel = comments.filter((comment) => !comment.parentCommentId);
  const repliesByParent = new Map<string, DiscussionCommentRecord[]>();
  for (const comment of comments) {
    if (!comment.parentCommentId) continue;
    const bucket = repliesByParent.get(comment.parentCommentId) ?? [];
    bucket.push(comment);
    repliesByParent.set(comment.parentCommentId, bucket);
  }

  return (
    <div className={styles.comments}>
      {comments.length > 0 ? (
        <p className={styles.commentsHeading}>
          {t("detail.commentsHeading", { count: comments.length })}
        </p>
      ) : null}
      {topLevel.length > 0 ? (
        <ul className={styles.commentList}>
          {topLevel.map((comment) => (
            <li key={comment.id}>
              <div className={styles.comment}>
                <span className={styles.commentAuthor}>{comment.authorDisplayName}</span>
                <span>{comment.body}</span>
                <span className={styles.commentMeta}>
                  <time dateTime={comment.createdAt.toISOString()}>
                    {formatRelativeTime(comment.createdAt, locale)}
                  </time>
                  {canComment ? (
                    <button
                      type="button"
                      onClick={() =>
                        setReplyingTo((current) => (current === comment.id ? null : comment.id))
                      }
                    >
                      {t("detail.reply")}
                    </button>
                  ) : null}
                </span>
              </div>
              {(repliesByParent.get(comment.id) ?? []).map((reply) => (
                <div key={reply.id} className={styles.commentReply}>
                  <span className={styles.commentAuthor}>{reply.authorDisplayName}</span>
                  <span>{reply.body}</span>
                  <span className={styles.commentMeta}>
                    <time dateTime={reply.createdAt.toISOString()}>
                      {formatRelativeTime(reply.createdAt, locale)}
                    </time>
                  </span>
                </div>
              ))}
              {replyingTo === comment.id ? (
                <div className={styles.commentReplyForm}>
                  <CommentForm
                    questionId={questionId}
                    target={{ ...target, parentCommentId: comment.id }}
                  />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {canComment ? <CommentForm questionId={questionId} target={target} /> : null}
    </div>
  );
}
