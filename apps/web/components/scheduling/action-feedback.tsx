"use client";

import { useTranslations } from "next-intl";

import type { SchedulingActionState } from "../../app/(app)/scheduling/action-state";
import styles from "./scheduling.module.css";

const MESSAGE_KEYS: Record<Exclude<SchedulingActionState["message"], null>, string> = {
  lessonScheduled: "feedback.lessonScheduled",
  seriesScheduled: "feedback.seriesScheduled",
  canceled: "feedback.canceled",
  rescheduled: "feedback.rescheduled",
  noShowRecorded: "feedback.noShowRecorded",
  attendanceRecorded: "feedback.attendanceRecorded",
  completed: "feedback.completed",
  zoomSaved: "feedback.zoomSaved",
  "errors.unauthenticated": "feedback.errors.unauthenticated",
  "errors.forbidden": "feedback.errors.forbidden",
  "errors.notFound": "feedback.errors.notFound",
  "errors.conflict": "feedback.errors.conflict",
  "errors.invalid": "feedback.errors.invalid",
  "errors.generic": "feedback.errors.generic",
};

export function ActionFeedback({ state }: { state: SchedulingActionState }) {
  const t = useTranslations("scheduling");
  if (state.message === null) return null;
  return (
    <p
      className={`${styles.feedback} ${
        state.status === "success" ? styles.feedbackSuccess : styles.feedbackError
      }`}
      role={state.status === "error" ? "alert" : "status"}
    >
      {t(MESSAGE_KEYS[state.message])}
    </p>
  );
}

export function FieldError({ state, name }: { state: SchedulingActionState; name: string }) {
  const t = useTranslations("scheduling");
  const messages = state.fieldErrors[name];
  if (!messages || messages.length === 0) return null;
  return (
    <p className={styles.fieldError} role="alert">
      {t("feedback.errors.invalidField")}
    </p>
  );
}
