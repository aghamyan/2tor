"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";

import { StudentForm } from "./student-form";
import styles from "./families.module.css";

export function NewStudentScreen() {
  const t = useTranslations("families.newStudent");

  return (
    <div className={styles.shell}>
      <div className={styles.backRow}>
        <Link className={styles.secondaryLink} href="/families">
          {t("back")}
        </Link>
      </div>
      <header className={styles.masthead}>
        <div>
          <p className={styles.eyebrow}>{t("eyebrow")}</p>
          <h1 className={styles.title}>{t("title")}</h1>
          <p className={styles.lede}>{t("intro")}</p>
        </div>
      </header>
      <section className={styles.panel}>
        <StudentForm />
        <p className={styles.privacyNote}>{t("activationNote")}</p>
      </section>
    </div>
  );
}
