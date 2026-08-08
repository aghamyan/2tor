"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";

import styles from "./tutors.module.css";

type SaveState = "idle" | "saving" | "saved" | "error";

export function ZoomSettingsForm({
  defaultZoomJoinUrl,
  defaultZoomPasscode,
}: {
  defaultZoomJoinUrl: string | null;
  defaultZoomPasscode: string | null;
}) {
  const t = useTranslations("tutors.zoomSettings");
  const router = useRouter();
  const [state, setState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("saving");
    setError(null);
    const form = new FormData(event.currentTarget);

    const response = await fetch("/api/tutors/me/zoom", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        defaultZoomJoinUrl: String(form.get("defaultZoomJoinUrl") ?? "").trim() || null,
        defaultZoomPasscode: String(form.get("defaultZoomPasscode") ?? "").trim() || null,
      }),
    });

    if (!response.ok) {
      setState("error");
      const body = await response.json().catch(() => null);
      setError(body?.error?.message ?? t("saveError"));
      return;
    }
    setState("saved");
    router.refresh();
  }

  return (
    <form
      className={styles.card}
      id="zoom-settings"
      onSubmit={save}
      aria-labelledby="zoom-settings-heading"
    >
      <div className={styles.cardHeader}>
        <div>
          <h2 className={styles.cardTitle} id="zoom-settings-heading">
            {t("title")}
          </h2>
          <p className={styles.cardDescription}>{t("description")}</p>
        </div>
      </div>

      <div className={styles.fieldGrid}>
        <label className={`${styles.field} ${styles.fieldWide}`}>
          <span>{t("joinUrl")}</span>
          <small>{t("joinUrlHelper")}</small>
          <input
            name="defaultZoomJoinUrl"
            type="url"
            defaultValue={defaultZoomJoinUrl ?? ""}
            maxLength={500}
            placeholder={t("joinUrlPlaceholder")}
          />
        </label>

        <label className={styles.field}>
          <span>{t("passcode")}</span>
          <input
            name="defaultZoomPasscode"
            defaultValue={defaultZoomPasscode ?? ""}
            maxLength={40}
            autoComplete="off"
          />
        </label>
      </div>

      <div className={styles.saveBar}>
        <span
          className={styles.saveStatus}
          data-tone={state === "saved" ? "success" : state === "error" ? "error" : undefined}
          aria-live="polite"
        >
          {state === "saving" && t("saving")}
          {state === "saved" && t("saved")}
          {state === "error" && (error ?? t("saveError"))}
        </span>
        <button className={styles.buttonPrimary} disabled={state === "saving"} type="submit">
          {t("save")}
        </button>
      </div>
    </form>
  );
}
