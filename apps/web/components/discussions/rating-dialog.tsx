"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@app/ui";

import type { DiscussionAnswerTutorRatingRecord } from "../../../../packages/domain/discussions/models";
import { rateAnswerAction, updateRatingAction } from "../../app/(app)/discussions/actions";
import { initialDiscussionActionState } from "../../app/(app)/discussions/action-state";
import { DiscussionActionFeedback } from "./discussion-action-feedback";
import { StarRatingInput } from "./star-rating-input";
import styles from "./rating-dialog.module.css";

const MIN_LOW_RATING_FEEDBACK_LENGTH = 20;

export function RatingDialog({
  answerId,
  questionId,
  existingRating,
}: {
  answerId: string;
  questionId: string;
  existingRating: DiscussionAnswerTutorRatingRecord | null;
}) {
  const t = useTranslations("discussions");
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState<number>(existingRating?.rating ?? 5);
  const action = existingRating
    ? updateRatingAction.bind(null, existingRating.id, questionId)
    : rateAnswerAction.bind(null, answerId, questionId);
  const [state, formAction, isPending] = useActionState(action, initialDiscussionActionState);
  const requiresFeedback = rating <= 2;

  // Closing the dialog on success is a render-time state adjustment (React's documented pattern
  // for reacting to a value change without an effect), not an effect — `state`'s identity only
  // changes when `useActionState` produces a new result, and it's deterministic on both server and
  // client (no browser-only API involved), so this can't cause a hydration mismatch.
  const [handledState, setHandledState] = useState(state);
  if (state !== handledState) {
    setHandledState(state);
    if (state.status === "success") setOpen(false);
  }

  return (
    <>
      <button type="button" className={styles.trigger} onClick={() => setOpen(true)}>
        {existingRating ? t("rating.editButton") : t("rating.rateButton")}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className={`${styles.root} ${styles.content}`}
          showCloseButton
          closeLabel={t("rating.close")}
        >
          <DialogHeader>
            <DialogTitle>{t("rating.dialogTitle")}</DialogTitle>
            <DialogDescription className={styles.description}>
              {t("rating.dialogDescription")}
            </DialogDescription>
          </DialogHeader>
          <form action={formAction} className={styles.form}>
            <StarRatingInput
              name="rating"
              value={rating}
              onChange={setRating}
              label={t("rating.starLabel")}
            />
            <label className={styles.feedbackLabel} htmlFor="rating-feedback">
              {requiresFeedback ? t("rating.feedbackRequiredLabel") : t("rating.feedbackLabel")}
            </label>
            <textarea
              id="rating-feedback"
              name="publicFeedback"
              rows={3}
              required={requiresFeedback}
              minLength={requiresFeedback ? MIN_LOW_RATING_FEEDBACK_LENGTH : undefined}
              defaultValue={existingRating?.publicFeedback ?? ""}
              placeholder={t("rating.feedbackPlaceholder")}
            />
            {requiresFeedback ? (
              <p className={styles.hint}>{t("rating.feedbackRequiredHint")}</p>
            ) : null}
            <DiscussionActionFeedback state={state} />
            <DialogFooter>
              <button type="button" className={styles.cancelButton} onClick={() => setOpen(false)}>
                {t("rating.cancel")}
              </button>
              <button type="submit" className={styles.submitButton} disabled={isPending}>
                {isPending ? t("rating.saving") : t("rating.save")}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
