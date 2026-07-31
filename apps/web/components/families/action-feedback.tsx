"use client";

import { useTranslations } from "next-intl";

import type { FamilyActionState } from "../../app/(app)/families/action-state";
import styles from "./families.module.css";

export function ActionFeedback({ state }: { state: FamilyActionState }) {
  const t = useTranslations("families.feedback");
  if (state.message === null) return null;

  const message =
    state.message === "saved"
      ? t("saved")
      : state.message === "studentCreated"
        ? t("studentCreated")
        : state.message === "unlinked"
          ? t("unlinked")
          : state.message === "errors.unauthenticated"
            ? t("errors.unauthenticated")
            : state.message === "errors.forbidden"
              ? t("errors.forbidden")
              : state.message === "errors.parentRequired"
                ? t("errors.parentRequired")
                : state.message === "errors.usernameTaken"
                  ? t("errors.usernameTaken")
                  : state.message === "errors.lastParent"
                    ? t("errors.lastParent")
                    : state.message === "errors.notFound"
                      ? t("errors.notFound")
                      : state.message === "errors.invalid"
                        ? t("errors.invalid")
                        : t("errors.generic");

  return (
    <p
      className={`${styles.feedback} ${
        state.status === "success" ? styles.feedbackSuccess : styles.feedbackError
      }`}
      role={state.status === "error" ? "alert" : "status"}
    >
      {message}
    </p>
  );
}

export function FieldError({ state, name }: { state: FamilyActionState; name: string }) {
  const t = useTranslations("families.feedback");
  const messages = state.fieldErrors[name];
  if (!messages || messages.length === 0) return null;
  return (
    <p className={styles.fieldError} role="alert">
      {t("errors.invalidField")}
    </p>
  );
}
