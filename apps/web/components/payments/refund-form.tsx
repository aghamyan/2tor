"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import styles from "./payments.module.css";

export function RefundForm({
  transactionId,
  amountMinor,
}: {
  transactionId: string;
  amountMinor: number;
}) {
  const t = useTranslations("payments.refunds");
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "done" | "error">("idle");

  async function submit() {
    setState("saving");
    const response = await fetch("/api/payments/refunds", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": crypto.randomUUID(),
      },
      body: JSON.stringify({ paymentTransactionId: transactionId, amountMinor, reason }),
    });
    setState(response.ok ? "done" : "error");
  }

  if (!open) {
    return (
      <button className={styles.textButton} type="button" onClick={() => setOpen(true)}>
        {t("open")}
      </button>
    );
  }

  return (
    <div className={styles.inlineForm}>
      <label>
        <span>{t("reason")}</span>
        <textarea
          value={reason}
          maxLength={2_000}
          onChange={(event) => setReason(event.target.value)}
          placeholder={t("reasonPlaceholder")}
        />
      </label>
      <button
        className={styles.dangerButton}
        type="button"
        disabled={reason.trim().length < 3 || state === "saving" || state === "done"}
        onClick={() => void submit()}
      >
        {state === "saving" ? t("saving") : state === "done" ? t("requested") : t("confirm")}
      </button>
      {state === "error" ? (
        <p className={styles.formError} role="alert">
          {t("error")}
        </p>
      ) : null}
    </div>
  );
}
