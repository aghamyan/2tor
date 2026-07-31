"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import type { ConsentStudentDetail } from "../../app/(app)/consent/queries";
import { ActivatePanel } from "./activate-panel";
import { ConsentForm } from "./consent-form";
import styles from "./consent.module.css";

export function StudentConsentScreen({ detail }: { detail: ConsentStudentDetail }) {
  const t = useTranslations("consent.studentScreen");
  const tForm = useTranslations("consent.form");

  const needsConsentStep = !detail.isAdultLearner && !detail.hasValidConsent;
  const needsActivation =
    detail.status !== "active" && (detail.hasValidConsent || detail.isAdultLearner);

  return (
    <div className={styles.shell}>
      <div className={styles.backRow}>
        <Link className={styles.secondaryLink} href="/consent">
          {t("back")}
        </Link>
      </div>
      <header className={styles.masthead}>
        <p className={styles.eyebrow}>{t("eyebrow")}</p>
        <h1 className={styles.title}>{detail.preferredName}</h1>
      </header>

      {detail.status === "active" ? (
        <p className={`${styles.statusBanner} ${styles.statusActive}`}>{t("activeBanner")}</p>
      ) : detail.isAdultLearner ? (
        <p className={`${styles.statusBanner} ${styles.statusPending}`}>
          {t("adultLearnerBanner", { name: detail.preferredName })}
        </p>
      ) : (
        <p className={`${styles.statusBanner} ${styles.statusPending}`}>
          {t("pendingBanner", { name: detail.preferredName })}
        </p>
      )}

      {detail.latestConsent ? (
        <p className={styles.quiet}>
          {t("consentOnFile", {
            date: detail.latestConsent.grantedAt.toLocaleDateString(),
            method: tForm(`methodOptions.${detail.latestConsent.method}`),
          })}
        </p>
      ) : null}

      {needsConsentStep ? (
        <ConsentForm
          studentProfileId={detail.studentProfileId}
          studentName={detail.preferredName}
        />
      ) : null}

      {needsActivation ? <ActivatePanel studentProfileId={detail.studentProfileId} /> : null}
    </div>
  );
}
