"use client";

import { useTranslations } from "next-intl";

import type { PayoutActionState } from "../../app/(app)/payouts/action-state";
import styles from "./payouts.module.css";

export function ActionFeedback({ state }: { state: PayoutActionState }) {
  const t = useTranslations("payouts.feedback");
  if (state.message === null) return null;
  return (
    <p
      className={`${styles.feedback} ${
        state.status === "success" ? styles.feedbackSuccess : styles.feedbackError
      }`}
      role={state.status === "error" ? "alert" : "status"}
    >
      {t(state.message)}
    </p>
  );
}
