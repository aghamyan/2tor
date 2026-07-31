"use client";

import { useTranslations } from "next-intl";

import { CURRENT_CONSENT_DATA_CATEGORIES } from "../../../../packages/domain/consent/schemas";
import styles from "./consent.module.css";

export function ChildDataNotice({ studentName }: { studentName: string }) {
  const t = useTranslations("consent.notice");

  return (
    <div className={styles.notice}>
      <p>{t("intro", { name: studentName })}</p>
      <h3>{t("categoriesTitle")}</h3>
      <ul>
        {CURRENT_CONSENT_DATA_CATEGORIES.map((key) => (
          <li key={key}>{t(`categories.${key}`)}</li>
        ))}
      </ul>
      <h3>{t("purposeTitle")}</h3>
      <p>{t("purposeText")}</p>
      <h3>{t("retentionTitle")}</h3>
      <p>{t("retentionText")}</p>
      <h3>{t("rightsTitle")}</h3>
      <p>{t("rightsText")}</p>
    </div>
  );
}
