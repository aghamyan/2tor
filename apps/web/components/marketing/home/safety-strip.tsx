import { ShieldCheckIcon } from "./icons";
import type { Cta } from "./content";
import styles from "./home.module.css";

export interface SafetyStripProps {
  statement: string;
  safetyLink: Cta;
  privacyLink: Cta;
}

export function SafetyStrip({ statement, safetyLink, privacyLink }: SafetyStripProps) {
  return (
    <section className={styles.safetyStrip} aria-label={statement}>
      <div className={styles.inner}>
        <div className={styles.safetyInner}>
          <div className={styles.safetyText}>
            <ShieldCheckIcon width={22} height={22} />
            <p>{statement}</p>
          </div>
          <div className={styles.safetyLinks}>
            <a href={safetyLink.href}>{safetyLink.label}</a>
            <a href={privacyLink.href}>{privacyLink.label}</a>
          </div>
        </div>
      </div>
    </section>
  );
}
