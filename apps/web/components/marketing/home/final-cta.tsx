import type { Cta } from "./content";
import styles from "./home.module.css";

export interface FinalCtaProps {
  title: string;
  description: string;
  primaryCta: Cta;
  secondaryCta: Cta;
}

export function FinalCta({ title, description, primaryCta, secondaryCta }: FinalCtaProps) {
  return (
    <section className={`${styles.finalCta} ${styles.onDark}`} aria-labelledby="final-cta-title">
      <div className={styles.inner}>
        <div className={styles.finalCtaInner}>
          <h2 className={styles.sectionTitle} id="final-cta-title">
            {title}
          </h2>
          <p className={styles.finalCtaLede}>{description}</p>
          <div className={styles.ctaRow}>
            <a className={styles.ctaPrimary} href={primaryCta.href}>
              {primaryCta.label}
            </a>
            <a className={styles.ctaSecondary} href={secondaryCta.href}>
              {secondaryCta.label}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
