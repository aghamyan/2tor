import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight, PlayCircle } from "lucide-react";
import { MonitoringVisual } from "../anti-cheating/monitoring-visual";
import type { AntiCheatingCopy } from "../anti-cheating/anti-cheating-content";
import styles from "./compact-home.module.css";

export interface AntiCheatingTeaserCopy {
  eyebrow: string;
  title: string;
  body: string;
  primary: string;
  secondary: string;
}

export function AntiCheatingTeaser({
  copy,
  exploreHref,
  howItWorksHref,
}: {
  copy: AntiCheatingTeaserCopy;
  exploreHref: string;
  howItWorksHref: string;
}) {
  // Reuses the already-translated visual copy from the dedicated Anti-Cheating page's own
  // namespace instead of re-authoring the sequence labels a second time in the homepage's inline
  // copy object.
  const t = useTranslations("antiCheating");
  const visualCopy = t.raw("content") as AntiCheatingCopy;

  return (
    <section className={styles.antiCheatingSection} aria-labelledby="anti-cheating-title">
      <div className={styles.sectionShell}>
        <div className={styles.antiCheatingGrid}>
          <div className={styles.antiCheatingCopy}>
            <p className={styles.sectionEyebrow}>{copy.eyebrow}</p>
            <h2 id="anti-cheating-title">{copy.title}</h2>
            <p className={styles.antiCheatingBody}>{copy.body}</p>
            <div className={styles.antiCheatingActions}>
              <Link href={exploreHref} className={styles.primaryAction}>
                {copy.primary}
                <span>
                  <ArrowRight size={18} aria-hidden="true" />
                </span>
              </Link>
              <Link href={howItWorksHref} className={styles.secondaryAction}>
                <PlayCircle size={18} aria-hidden="true" />
                {copy.secondary}
              </Link>
            </div>
          </div>
          <MonitoringVisual copy={visualCopy.visual} size="compact" />
        </div>
      </div>
    </section>
  );
}
