import { useTranslations } from "next-intl";
import styles from "./academics.module.css";

export function AcademicsOverview() {
  const t = useTranslations("academics.overview");
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <p className={styles.kicker}>{t("kicker")}</p>
        <h1>{t("title")}</h1>
        <p>{t("intro")}</p>
      </header>
      <div className={styles.grid}>
        <section className={styles.card}>
          <h2>{t("plans.title")}</h2>
          <p>{t("plans.body")}</p>
        </section>
        <section className={styles.card}>
          <h2>{t("feedback.title")}</h2>
          <p>{t("feedback.body")}</p>
        </section>
        <section className={styles.card}>
          <h2>{t("milestones.title")}</h2>
          <p>{t("milestones.body")}</p>
        </section>
      </div>
      <p className={styles.note}>{t("privacy")}</p>
    </div>
  );
}
