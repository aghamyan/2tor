import { useTranslations } from "next-intl";
import styles from "./discussions.module.css";

export function DiscussionsOverview() {
  const t = useTranslations("discussions.overview");
  const cards = ["scope", "identity", "review"] as const;
  return (
    <div className={styles.shell}>
      <header className={styles.masthead}>
        <p className={styles.eyebrow}>{t("eyebrow")}</p>
        <h1>{t("title")}</h1>
        <p>{t("intro")}</p>
      </header>

      <div className={styles.principles}>
        {cards.map((card) => (
          <section key={card}>
            <h2>{t(`${card}.title`)}</h2>
            <p>{t(`${card}.body`)}</p>
          </section>
        ))}
      </div>

      <section className={styles.question} aria-label={t("sample.label")}>
        <div className={styles.questionHead}>
          <div>
            <span>{t("sample.label")}</span>
            <h2>{t("sample.title")}</h2>
            <p>{t("sample.scope")}</p>
          </div>
          <small>{t("sample.private")}</small>
        </div>
        <ol className={styles.answers}>
          <li>
            <div className={styles.answerMeta}>
              <strong>{t("sample.answerer")}</strong>
              <span className={styles.unverified}>{t("sample.unverified")}</span>
            </div>
            <p>{t("sample.answer")}</p>
          </li>
          <li>
            <div className={styles.answerMeta}>
              <strong>{t("sample.tutor")}</strong>
              <span className={styles.verified}>{t("sample.verified")}</span>
            </div>
            <p>{t("sample.tutorAnswer")}</p>
          </li>
        </ol>
      </section>

      <aside className={styles.notes}>
        <p>{t("safety")}</p>
        <p>{t("sla")}</p>
        <p>{t("noDm")}</p>
      </aside>
    </div>
  );
}
