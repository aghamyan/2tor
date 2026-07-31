"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import styles from "./payments.module.css";

export function DiscountForm() {
  const t = useTranslations("payments.discounts");
  const [code, setCode] = useState("");
  const [percent, setPercent] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "done" | "error">("idle");

  async function save() {
    const basisPoints = Number(percent) * 100;
    setState("saving");
    const response = await fetch("/api/payments/discounts", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": crypto.randomUUID(),
      },
      body: JSON.stringify({
        code,
        type: "admin_manual",
        percentOffBasisPoints: basisPoints,
        amountOffMinor: null,
        currency: null,
        startsAt: null,
        endsAt: null,
      }),
    });
    setState(response.ok ? "done" : "error");
  }

  return (
    <div className={styles.discountForm}>
      <label>
        <span>{t("code")}</span>
        <input value={code} maxLength={64} onChange={(event) => setCode(event.target.value)} />
      </label>
      <label>
        <span>{t("percent")}</span>
        <input
          value={percent}
          type="number"
          min="0.01"
          max="100"
          step="0.01"
          onChange={(event) => setPercent(event.target.value)}
        />
      </label>
      <button
        className={styles.payButton}
        type="button"
        disabled={!code.trim() || !(Number(percent) > 0) || state === "saving"}
        onClick={() => void save()}
      >
        {state === "saving" ? t("saving") : state === "done" ? t("created") : t("create")}
      </button>
      {state === "error" ? (
        <p className={styles.formError} role="alert">
          {t("error")}
        </p>
      ) : null}
    </div>
  );
}
