import { CompassIcon } from "./icons";
import type { Cta } from "./content";
import styles from "./home.module.css";

export interface TutorsProps {
  eyebrow: string;
  title: string;
  description: string;
  cta: Cta;
}

export function Tutors({ eyebrow, title, description, cta }: TutorsProps) {
  return (
    <section className={styles.tutorsBand} aria-labelledby="tutors-title">
      <div className={styles.inner}>
        <div className={styles.tutorsInner}>
          <div>
            <p className={styles.eyebrow}>{eyebrow}</p>
            <h2 className={styles.sectionTitle} id="tutors-title">
              {title}
            </h2>
            <p className={styles.tutorsLede}>{description}</p>
            <div className={`${styles.ctaRow} ${styles.onDark} ${styles.parentsCtaRow}`}>
              <a className={styles.ctaSecondary} href={cta.href}>
                {cta.label}
              </a>
            </div>
          </div>
          <div className={styles.tutorsAvatarRow} aria-hidden="true">
            {[0, 1, 2, 3].map((index) => (
              <span className={styles.tutorsAvatar} key={index}>
                <CompassIcon width={22} height={22} />
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
