import Link from "next/link";
import { ArrowRight, PlayCircle } from "lucide-react";
import styles from "./anti-cheating-page.module.css";

export interface AntiCheatingCtaProps {
  title: string;
  body: string;
  primary: { label: string; href: string };
  secondary: { label: string; href: string };
}

export function AntiCheatingCta({ title, body, primary, secondary }: AntiCheatingCtaProps) {
  return (
    <section className={styles.finalCtaSection} aria-labelledby="anti-cheating-final-cta">
      <div className={styles.shell}>
        <div className={styles.finalCtaCard}>
          <h2 id="anti-cheating-final-cta">{title}</h2>
          <p>{body}</p>
          <div className={styles.finalCtaActions}>
            <Link href={primary.href} className={styles.primaryCta}>
              {primary.label}
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <Link href={secondary.href} className={styles.secondaryCta}>
              <PlayCircle size={18} aria-hidden="true" />
              {secondary.label}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
