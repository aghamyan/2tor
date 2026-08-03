"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";

import type { TutorProfileRecord } from "../../../../packages/domain/tutors/models";
import styles from "./tutors.module.css";

type SaveState = "idle" | "saving" | "saved" | "error";

const HEADLINE_MAX = 180;
const BIO_MAX = 4_000;
const EDUCATION_MAX = 2_000;

export function TeachingProfileForm({ profile }: { profile: TutorProfileRecord | null }) {
  const t = useTranslations("tutors.profile");
  const router = useRouter();
  const [state, setState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [headlineLength, setHeadlineLength] = useState(profile?.headline?.length ?? 0);
  const [bioLength, setBioLength] = useState(profile?.bio?.length ?? 0);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("saving");
    setError(null);
    const form = new FormData(event.currentTarget);
    const yearsRaw = String(form.get("yearsExperience") ?? "").trim();

    const response = await fetch("/api/tutors/me", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        publicDisplayName: String(form.get("publicDisplayName") ?? "").trim(),
        headline: String(form.get("headline") ?? "").trim() || null,
        bio: String(form.get("bio") ?? "").trim() || null,
        country: String(form.get("country") ?? "").trim() || null,
        yearsExperience: yearsRaw ? Number(yearsRaw) : null,
        educationSummary: String(form.get("educationSummary") ?? "").trim() || null,
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
    <form className={styles.card} id="teaching-profile" onSubmit={save} aria-labelledby="teaching-profile-heading">
      <div className={styles.cardHeader}>
        <div>
          <h2 className={styles.cardTitle} id="teaching-profile-heading">
            {t("title")}
          </h2>
          <p className={styles.cardDescription}>{t("description")}</p>
        </div>
      </div>

      <div className={styles.fieldGrid}>
        <label className={styles.field}>
          <span>{t("displayName")}</span>
          <input
            name="publicDisplayName"
            defaultValue={profile?.publicDisplayName ?? ""}
            maxLength={120}
            required
            autoComplete="name"
          />
        </label>

        <label className={styles.field}>
          <span>{t("yearsExperience")}</span>
          <input
            name="yearsExperience"
            type="number"
            min={0}
            max={80}
            defaultValue={profile?.yearsExperience ?? ""}
            inputMode="numeric"
          />
        </label>

        <label className={`${styles.field} ${styles.fieldWide}`}>
          <span className={styles.fieldHint}>
            {t("headline")}
            <span className={styles.charCount}>{headlineLength}/{HEADLINE_MAX}</span>
          </span>
          <input
            name="headline"
            defaultValue={profile?.headline ?? ""}
            maxLength={HEADLINE_MAX}
            placeholder={t("headlinePlaceholder")}
            onChange={(event) => setHeadlineLength(event.currentTarget.value.length)}
          />
        </label>

        <label className={`${styles.field} ${styles.fieldWide}`}>
          <span className={styles.fieldHint}>
            {t("bio")}
            <span className={styles.charCount}>{bioLength}/{BIO_MAX}</span>
          </span>
          <small>{t("bioHelper")}</small>
          <textarea
            name="bio"
            defaultValue={profile?.bio ?? ""}
            maxLength={BIO_MAX}
            rows={5}
            onChange={(event) => setBioLength(event.currentTarget.value.length)}
          />
        </label>

        <label className={styles.field}>
          <span>{t("country")}</span>
          <input name="country" defaultValue={profile?.country ?? ""} maxLength={80} autoComplete="country-name" />
        </label>

        <label className={`${styles.field} ${styles.fieldWide}`}>
          <span>{t("education")}</span>
          <small>{t("educationHelper")}</small>
          <textarea
            name="educationSummary"
            defaultValue={profile?.educationSummary ?? ""}
            maxLength={EDUCATION_MAX}
            rows={3}
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
          {profile ? t("save") : t("create")}
        </button>
      </div>
    </form>
  );
}
