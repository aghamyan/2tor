import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import type { Locale } from "@app/i18n/config";
import type { AntiCheatingCopy } from "./anti-cheating-content";
import { MonitoringIndicator } from "./monitoring-indicator";
import styles from "./anti-cheating-page.module.css";

export function PrivacySection({
  copy,
  locale,
}: {
  copy: AntiCheatingCopy["privacy"];
  locale: Locale;
}) {
  return (
    <section className={styles.privacySection} aria-labelledby="privacy-title">
      <div className={styles.shell}>
        <div className={styles.privacyGrid}>
          <div>
            <p className={styles.eyebrow}>{copy.eyebrow}</p>
            <h2 id="privacy-title">{copy.title}</h2>
            <p className={styles.sectionLede}>{copy.body}</p>
            <MonitoringIndicator
              activeLabel={copy.indicator.activeLabel}
              cameraOnLabel={copy.indicator.cameraOnLabel}
              cameraOffLabel={copy.indicator.cameraOffLabel}
              cameraEnabled={false}
            />
            <Link href={`/${locale}/privacy`} className={styles.privacyPolicyLink}>
              <ShieldCheck size={15} aria-hidden="true" />
              {copy.policyLink}
            </Link>
          </div>
          <ul className={styles.privacyList}>
            {copy.points.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
