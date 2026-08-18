"use client";

import { useTranslations } from "next-intl";

import type { DiscussionActionState } from "../../app/(app)/discussions/action-state";
import styles from "./feed.module.css";

const MESSAGE_KEYS: Record<Exclude<DiscussionActionState["message"], null>, string> = {
  questionPosted: "feedback.questionPosted",
  attachmentUploaded: "feedback.attachmentUploaded",
  questionUpdated: "feedback.questionUpdated",
  questionDeleted: "feedback.questionDeleted",
  questionClosed: "feedback.questionClosed",
  questionReopened: "feedback.questionReopened",
  questionLocked: "feedback.questionLocked",
  questionUnlocked: "feedback.questionUnlocked",
  questionMarkedDuplicate: "feedback.questionMarkedDuplicate",
  answerPosted: "feedback.answerPosted",
  answerUpdated: "feedback.answerUpdated",
  answerDeleted: "feedback.answerDeleted",
  answerAccepted: "feedback.answerAccepted",
  answerUnaccepted: "feedback.answerUnaccepted",
  helpfulVoted: "feedback.helpfulVoted",
  answerVerified: "feedback.answerVerified",
  revisionRequested: "feedback.revisionRequested",
  ratingSaved: "feedback.ratingSaved",
  ratingUpdated: "feedback.ratingUpdated",
  ratingRemoved: "feedback.ratingRemoved",
  ratingInvalidated: "feedback.ratingInvalidated",
  commentPosted: "feedback.commentPosted",
  commentUpdated: "feedback.commentUpdated",
  commentDeleted: "feedback.commentDeleted",
  correctionProposed: "feedback.correctionProposed",
  correctionResponded: "feedback.correctionResponded",
  correctionResolved: "feedback.correctionResolved",
  followed: "feedback.followed",
  unfollowed: "feedback.unfollowed",
  saved: "feedback.saved",
  unsaved: "feedback.unsaved",
  reported: "feedback.reported",
  reportAssigned: "feedback.reportAssigned",
  reportResolved: "feedback.reportResolved",
  contentRemoved: "feedback.contentRemoved",
  contentRestored: "feedback.contentRestored",
  "errors.unauthenticated": "feedback.errors.unauthenticated",
  "errors.forbidden": "feedback.errors.forbidden",
  "errors.notFound": "feedback.errors.notFound",
  "errors.conflict": "feedback.errors.conflict",
  "errors.invalid": "feedback.errors.invalid",
  "errors.rateLimited": "feedback.errors.rateLimited",
  "errors.generic": "feedback.errors.generic",
};

export function DiscussionActionFeedback({ state }: { state: DiscussionActionState }) {
  const t = useTranslations("discussions");
  if (state.message === null) return null;
  return (
    <p
      className={styles.actionFeedback}
      data-tone={state.status === "success" ? "green" : "danger"}
      role={state.status === "error" ? "alert" : "status"}
    >
      {t(MESSAGE_KEYS[state.message] as never)}
    </p>
  );
}
