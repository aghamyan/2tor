import { ArrowRightIcon, CodeIcon, HeritageIcon, MathIcon } from "./icons";
import type { Cta } from "./content";
import styles from "./home.module.css";

export interface SubjectCard {
  key: "mathematics" | "programming" | "heritage";
  title: string;
  body: string;
  cta: Cta;
}

export interface SubjectsProps {
  eyebrow: string;
  title: string;
  description: string;
  subjects: readonly SubjectCard[];
}

const ICON_BY_KEY = {
  mathematics: MathIcon,
  programming: CodeIcon,
  heritage: HeritageIcon,
} as const;

export function Subjects({ eyebrow, title, description, subjects }: SubjectsProps) {
  return (
    <section className={styles.section} aria-labelledby="subjects-title">
      <div className={styles.inner}>
        <div className={styles.sectionHead}>
          <p className={styles.eyebrow}>{eyebrow}</p>
          <h2 className={styles.sectionTitle} id="subjects-title">
            {title}
          </h2>
          <p className={styles.sectionLede}>{description}</p>
        </div>
        <div className={styles.subjectsGrid}>
          {subjects.map((subject) => {
            const Icon = ICON_BY_KEY[subject.key];
            const featured = subject.key === "heritage";
            return (
              <article
                className={`${styles.subjectCard} ${featured ? styles.subjectFeatured : ""}`}
                key={subject.key}
              >
                <span className={styles.subjectIcon}>
                  <Icon width={24} height={24} />
                </span>
                <h3 className={styles.subjectTitle}>{subject.title}</h3>
                <p className={styles.subjectBody}>{subject.body}</p>
                <a className={styles.subjectLink} href={subject.cta.href}>
                  {subject.cta.label}
                  <ArrowRightIcon width={16} height={16} />
                </a>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
