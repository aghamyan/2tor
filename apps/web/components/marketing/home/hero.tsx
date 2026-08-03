import Link from "next/link";
import { ArrowRight, Check, ClipboardCheck, GraduationCap, ShieldCheck } from "lucide-react";
import { ClassroomPreview, type ClassroomCopy } from "./compact-home";
import styles from "./compact-home.module.css";

export interface HeroProps {
  eyebrow: string;
  titleLead: string;
  titleAccent: string;
  description: string;
  primaryCta: { label: string; href: string };
  secondaryCta: { label: string; href: string };
  trust: readonly string[];
  socialProof: string;
  classroom: ClassroomCopy;
}

/** The headline and primary actions stay server-rendered; only the product demo hydrates. */
export function Hero({
  eyebrow,
  titleLead,
  titleAccent,
  description,
  primaryCta,
  secondaryCta,
  trust,
  socialProof,
  classroom,
}: HeroProps) {
  return (
    <section className={styles.hero} aria-labelledby="home-title">
      <div className={styles.heroBackdrop} aria-hidden="true">
        <span className={styles.heroGrid} />
        <span className={styles.pathLine} />
        <span className={styles.armenianGlyph}>Ա</span>
        <span className={styles.codeGlyph}>&#123; &#125;</span>
      </div>

      <div className={styles.heroShell}>
        <div className={styles.heroLayout}>
          <div className={styles.heroCopy}>
            <p className={styles.heroEyebrow}>
              <span aria-hidden="true" />
              {eyebrow}
            </p>
            <h1 id="home-title" className={styles.heroTitle}>
              {titleLead}{" "}
              <span>
                {titleAccent}
                <i aria-hidden="true" />
              </span>
            </h1>
            <p className={styles.heroDescription}>{description}</p>

            <div className={styles.heroActions}>
              <Link href={primaryCta.href} className={styles.primaryAction}>
                {primaryCta.label}
                <span>
                  <ArrowRight size={18} aria-hidden="true" />
                </span>
              </Link>
              <Link href={secondaryCta.href} className={styles.secondaryAction}>
                <GraduationCap size={18} aria-hidden="true" />
                {secondaryCta.label}
              </Link>
            </div>

            <ul className={styles.trustList} aria-label="Why families choose 2tor">
              {trust.map((item, index) => (
                <li key={item}>
                  {index === 1 ? (
                    <ClipboardCheck size={15} aria-hidden="true" />
                  ) : index === 3 ? (
                    <ShieldCheck size={15} aria-hidden="true" />
                  ) : (
                    <Check size={15} aria-hidden="true" />
                  )}
                  {item}
                </li>
              ))}
            </ul>

            <div className={styles.socialProof}>
              <div className={styles.avatarStack} aria-hidden="true">
                <span>MK</span>
                <span>AS</span>
                <span>NV</span>
              </div>
              <p>{socialProof}</p>
            </div>
          </div>

          <ClassroomPreview copy={classroom} />
        </div>
      </div>
    </section>
  );
}
