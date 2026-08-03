"use client";

import { useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import styles from "./marketing.module.css";

export function LeadForm({
  kind = "consultation",
  defaultInterest,
}: {
  kind?: "consultation" | "assessment" | "contact" | "tutor_application" | "trial_class";
  defaultInterest?: string;
}) {
  const t = useTranslations("marketing.form");
  const locale = useLocale();
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const response = await fetch("/api/leads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...values,
        kind,
        locale,
        privacyConsent: values.privacyConsent === "on",
      }),
    });
    setStatus(response.ok ? "sent" : "error");
    if (response.ok) event.currentTarget.reset();
  }
  if (status === "sent")
    return (
      <p className={styles.formSuccess} role="status">
        {t("success")}
      </p>
    );
  return (
    <form className={styles.form} onSubmit={submit}>
      <div className={styles.field}>
        <label htmlFor="lead-name">{t("name")}</label>
        <input id="lead-name" name="parentName" autoComplete="name" required maxLength={120} />
      </div>
      <div className={styles.field}>
        <label htmlFor="lead-email">{t("email")}</label>
        <input
          id="lead-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          maxLength={254}
        />
      </div>
      <div className={styles.field}>
        <label htmlFor="lead-phone">{t("phone")}</label>
        <input id="lead-phone" name="phone" type="tel" autoComplete="tel" maxLength={40} />
      </div>
      <div className={styles.field}>
        <label htmlFor="lead-age">{t("age")}</label>
        <select id="lead-age" name="learnerAgeBand" defaultValue="">
          <option value="">{t("notSpecified")}</option>
          <option value="under_8">{t("under8")}</option>
          <option value="8_10">8–10</option>
          <option value="11_13">11–13</option>
          <option value="14_17">14–17</option>
          <option value="adult">{t("adult")}</option>
        </select>
      </div>
      <div className={styles.field}>
        <label htmlFor="lead-interest">{t("interest")}</label>
        <input
          id="lead-interest"
          name="interest"
          maxLength={160}
          defaultValue={defaultInterest}
        />
      </div>
      <div className={styles.field}>
        <label htmlFor="lead-message">{t("message")}</label>
        <textarea id="lead-message" name="message" maxLength={1000} />
      </div>
      <div className={styles.honeypot} aria-hidden="true">
        <label htmlFor="lead-company">Company</label>
        <input id="lead-company" name="company" tabIndex={-1} autoComplete="off" />
      </div>
      <label className={styles.consent}>
        <input name="privacyConsent" type="checkbox" required /> <span>{t("consent")}</span>
      </label>
      {status === "error" && (
        <p className={styles.formError} role="alert">
          {t("error")}
        </p>
      )}
      <button className={styles.primary} type="submit" disabled={status === "sending"}>
        {status === "sending" ? t("sending") : t("submit")}
      </button>
    </form>
  );
}
