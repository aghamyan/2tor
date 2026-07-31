import type { Cta } from "./content";
import styles from "./home.module.css";

export interface HeroProps {
  eyebrow: string;
  title: string;
  description: string;
  primaryCta: Cta;
  secondaryCta: Cta;
  trustLabel: string;
  trustVerified: string;
  trustVisible: string;
  trustSafe: string;
  visualLabel: string;
  visualHeadline: string;
  visualNote: string;
}

/** Above-the-fold: renders synchronously, no client JS, no `ScrollReveal` wrapper — protects LCP. */
export function Hero({
  eyebrow,
  title,
  description,
  primaryCta,
  secondaryCta,
  trustLabel,
  trustVerified,
  trustVisible,
  trustSafe,
  visualLabel,
  visualHeadline,
  visualNote,
}: HeroProps) {
  return (
    <section className={styles.hero}>
      <div className={styles.inner}>
        <div className={styles.heroInner}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>{eyebrow}</p>
            <h1 className={styles.heroTitle}>{title}</h1>
            <p className={styles.heroLede}>{description}</p>
            <div className={styles.ctaRow}>
              <a className={styles.ctaPrimary} href={primaryCta.href}>
                {primaryCta.label}
              </a>
              <a className={styles.ctaSecondary} href={secondaryCta.href}>
                {secondaryCta.label}
              </a>
            </div>
            <ul className={styles.heroTrust} aria-label={trustLabel}>
              <li>{trustVerified}</li>
              <li>{trustVisible}</li>
              <li>{trustSafe}</li>
            </ul>
          </div>
          <aside className={styles.heroVisual} aria-hidden="true">
            <p className={styles.heroVisualLabel}>{visualLabel}</p>
            <p className={styles.heroVisualHeadline}>{visualHeadline}</p>
            <svg
              className={styles.heroTrail}
              viewBox="0 0 320 120"
              width="320"
              height="120"
              role="presentation"
            >
              <path
                d="M8 96 C 60 96, 60 70, 100 66 S 160 40, 190 42 S 250 14, 312 12"
                fill="none"
                stroke="hsl(var(--home-accent))"
                strokeWidth="3"
                strokeLinecap="round"
              />
              {[
                [8, 96],
                [100, 66],
                [190, 42],
                [312, 12],
              ].map(([cx, cy]) => (
                <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={5} fill="hsl(var(--home-accent))" />
              ))}
            </svg>
            <p className={styles.heroVisualNote}>{visualNote}</p>
          </aside>
        </div>
      </div>
    </section>
  );
}
