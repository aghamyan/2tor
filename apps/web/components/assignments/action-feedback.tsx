"use client";

import { useTranslations } from "next-intl";

import type { AssignmentActionState } from "../../app/(app)/assignments/action-state";
import styles from "./assignments.module.css";

const MESSAGE_KEYS: Record<Exclude<AssignmentActionState["message"], null>, string> = {
  assignmentCreated: "feedback.assignmentCreated",
  assignmentPublished: "feedback.assignmentPublished",
  assignmentClosed: "feedback.assignmentClosed",
  saved: "feedback.saved",
  submitted: "feedback.submitted",
  graded: "feedback.graded",
  rubricCreated: "feedback.rubricCreated",
  "errors.unauthenticated": "feedback.errors.unauthenticated",
  "errors.forbidden": "feedback.errors.forbidden",
  "errors.notFound": "feedback.errors.notFound",
  "errors.conflict": "feedback.errors.conflict",
  "errors.invalid": "feedback.errors.invalid",
  "errors.generic": "feedback.errors.generic",
};

export function ActionFeedback({ state }: { state: AssignmentActionState }) {
  const t = useTranslations("assignments");
  if (state.message === null) return null;
  return (
    <p
      className={`${styles.feedback} ${
        state.status === "success" ? styles.feedbackSuccess : styles.feedbackError
      }`}
      role={state.status === "error" ? "alert" : "status"}
      aria-live={state.status === "error" ? "assertive" : "polite"}
    >
      {t(MESSAGE_KEYS[state.message])}
    </p>
  );
}

export function fieldErrorId(name: string): string {
  return `${name}-error`;
}

/**
 * Always renders the `<p id>` element, even with no error, so an input's `aria-describedby` (set
 * unconditionally via {@link fieldErrorId}) never points at a missing node — a target that only
 * exists once a validation error occurs would itself be an accessibility-tree defect.
 */
export function FieldError({ state, name }: { state: AssignmentActionState; name: string }) {
  const t = useTranslations("assignments");
  const messages = state.fieldErrors[name];
  const hasError = Boolean(messages && messages.length > 0);
  return (
    <p className={styles.fieldError} id={fieldErrorId(name)} role={hasError ? "alert" : undefined}>
      {hasError ? t("feedback.errors.invalidField") : null}
    </p>
  );
}
