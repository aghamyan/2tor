"use client";

import { useActionState, useId } from "react";
import { useTranslations } from "next-intl";

import { postCommentAction } from "../../app/(app)/discussions/actions";
import { initialDiscussionActionState } from "../../app/(app)/discussions/action-state";
import { DiscussionActionFeedback } from "./discussion-action-feedback";
import styles from "./question-detail.module.css";

export interface CommentTarget {
  questionId?: string;
  answerId?: string;
  parentCommentId?: string;
}

export function CommentForm({ questionId, target }: { questionId: string; target: CommentTarget }) {
  const t = useTranslations("discussions");
  const [state, formAction, isPending] = useActionState(
    postCommentAction.bind(null, questionId),
    initialDiscussionActionState,
  );
  const fieldId = useId();

  return (
    <form action={formAction} className={styles.commentForm}>
      {target.questionId ? (
        <input type="hidden" name="questionId" value={target.questionId} />
      ) : null}
      {target.answerId ? <input type="hidden" name="answerId" value={target.answerId} /> : null}
      {target.parentCommentId ? (
        <input type="hidden" name="parentCommentId" value={target.parentCommentId} />
      ) : null}
      <label htmlFor={fieldId} className={styles.srOnly}>
        {t("detail.commentPlaceholder")}
      </label>
      <textarea
        id={fieldId}
        name="body"
        required
        rows={2}
        placeholder={t("detail.commentPlaceholder")}
      />
      <button type="submit" disabled={isPending}>
        {t("detail.postComment")}
      </button>
      <DiscussionActionFeedback state={state} />
    </form>
  );
}
