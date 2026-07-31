import { useTranslations } from "next-intl";
import { competitionCardIsVisible } from "./competition-visibility";
import styles from "./gamification.module.css";

export interface GamificationOverviewProps {
  /** Comes from the parent-controlled per-child setting. Defaults to safe, private mode. */
  competitionEnabled: boolean;
}

export function GamificationOverview({ competitionEnabled }: GamificationOverviewProps) {
  const t = useTranslations("gamification.overview");
  const showCompetition = competitionCardIsVisible(competitionEnabled);
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <p className={styles.kicker}>{t("kicker")}</p>
        <h1>{t("title")}</h1>
        <p>{t("intro")}</p>
      </header>
      <section className={styles.progress} aria-labelledby="progress-title">
        <div>
          <p className={styles.eyebrow}>{t("progress.label")}</p>
          <h2 id="progress-title">{t("progress.title")}</h2>
          <p>{t("progress.body")}</p>
        </div>
        <div className={styles.points} aria-label={t("progress.pointsLabel")}>
          <span>•••</span>
          <strong>{t("progress.points")}</strong>
          <small>{t("progress.pointsLabel")}</small>
        </div>
      </section>
      <div className={styles.grid}>
        {(["streaks", "badges", "challenges"] as const).map((key) => (
          <section key={key} className={styles.card}>
            <h2>{t(`${key}.title`)}</h2>
            <p>{t(`${key}.body`)}</p>
          </section>
        ))}
      </div>
      {showCompetition ? (
        <section
          className={styles.community}
          data-testid="seasonal-community"
          aria-labelledby="community-title"
        >
          <p className={styles.eyebrow}>{t("community.kicker")}</p>
          <h2 id="community-title">{t("community.title")}</h2>
          <p>{t("community.body")}</p>
        </section>
      ) : null}
      <p className={styles.note}>{t("privacy")}</p>
    </div>
  );
}
