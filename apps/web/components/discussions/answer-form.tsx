"use client";

import { useActionState, useId } from "react";
import { useTranslations } from "next-intl";

import { postAnswerAction } from "../../app/(app)/discussions/actions";
import { initialDiscussionActionState } from "../../app/(app)/discussions/action-state";
import { DiscussionActionFeedback } from "./discussion-action-feedback";
import styles from "./question-detail.module.css";

export function AnswerForm({ questionId }: { questionId: string }) {
  const t = useTranslations("discussions");
  const [state, formAction, isPending] = useActionState(
    postAnswerAction.bind(null, questionId),
    initialDiscussionActionState,
  );
  const fieldId = useId();

  return (
    <form action={formAction} className={styles.answerForm}>
      <h2>{t("detail.yourAnswerHeading")}</h2>
      <label htmlFor={fieldId} className={styles.srOnly}>
        {t("detail.answerPlaceholder")}
      </label>
      <textarea
        id={fieldId}
        name="body"
        required
        rows={6}
        placeholder={t("detail.answerPlaceholder")}
      />
      <button type="submit" disabled={isPending}>
        {isPending ? t("detail.posting") : t("detail.postAnswer")}
      </button>
      <DiscussionActionFeedback state={state} />
    </form>
  );
}
