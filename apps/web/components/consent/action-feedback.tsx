"use client";

import { useTranslations } from "next-intl";

import type { ConsentActionState } from "../../app/(app)/consent/action-state";
import styles from "./consent.module.css";

export function ActionFeedback({ state }: { state: ConsentActionState }) {
  const t = useTranslations("consent.feedback");
  if (state.message === null) return null;

  const message =
    state.message === "consentRecorded"
      ? t("consentRecorded")
      : state.message === "activated"
        ? t("activated")
        : state.message === "errors.unauthenticated"
          ? t("errors.unauthenticated")
          : state.message === "errors.forbidden"
            ? t("errors.forbidden")
            : state.message === "errors.notFound"
              ? t("errors.notFound")
              : state.message === "errors.parentRequired"
                ? t("errors.parentRequired")
                : state.message === "errors.contactVerificationRequired"
                  ? t("errors.contactVerificationRequired")
                  : state.message === "errors.consentNotApplicable"
                    ? t("errors.consentNotApplicable")
                    : state.message === "errors.methodNotSupported"
                      ? t("errors.methodNotSupported")
                      : state.message === "errors.verificationFailed"
                        ? t("errors.verificationFailed")
                        : state.message === "errors.consentRequired"
                          ? t("errors.consentRequired")
                          : state.message === "errors.familyNotReady"
                            ? t("errors.familyNotReady")
                            : state.message === "errors.accountSuspended"
                              ? t("errors.accountSuspended")
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
