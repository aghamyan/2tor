"use client";

import Image from "next/image";
import type { PointerEvent } from "react";
import { ArrowRightIcon, CodeIcon, HeritageIcon, MathIcon, SatIcon, ToeflIcon } from "./icons";
import { SUBJECT_IMAGE_SOURCES, type Cta, type SubjectKey } from "./content";
import styles from "./home.module.css";

export interface SubjectCard {
  key: SubjectKey;
  title: string;
  body: string;
  cta: Cta;
  highlights: readonly string[];
}

export interface SubjectsProps {
  eyebrow: string;
  title: string;
  description: string;
  subjects: readonly SubjectCard[];
  pageLead?: boolean;
}

const ICON_BY_KEY = {
  mathematics: MathIcon,
  programming: CodeIcon,
  heritage: HeritageIcon,
  sat: SatIcon,
  toefl: ToeflIcon,
} as const;

function trackCardPointer(event: PointerEvent<HTMLAnchorElement>) {
  const bounds = event.currentTarget.getBoundingClientRect();
  event.currentTarget.style.setProperty("--subject-x", `${event.clientX - bounds.left}px`);
  event.currentTarget.style.setProperty("--subject-y", `${event.clientY - bounds.top}px`);
}

export function Subjects({
  eyebrow,
  title,
  description,
  subjects,
  pageLead = false,
}: SubjectsProps) {
  return (
    <section
      className={`${styles.section} ${pageLead ? styles.subjectsLead : ""}`}
      aria-labelledby="subjects-title"
    >
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
              <a
                className={`${styles.subjectCard} ${featured ? styles.subjectFeatured : ""}`}
                href={subject.cta.href}
                key={subject.key}
                onPointerMove={trackCardPointer}
              >
                <span className={styles.subjectMedia} aria-hidden="true">
                  <Image
                    className={styles.subjectImage}
                    src={SUBJECT_IMAGE_SOURCES[subject.key]}
                    alt=""
                    width={1200}
                    height={900}
                    priority={featured}
                    sizes={
                      featured
                        ? "(max-width: 1088px) 100vw, 38vw"
                        : "(max-width: 576px) 100vw, (max-width: 1088px) 50vw, 30vw"
                    }
                  />
                  <span className={styles.subjectIcon}>
                    <Icon width={24} height={24} />
                  </span>
                </span>
                <span className={styles.subjectContent}>
                  <span className={styles.subjectCopy}>
                    <h3 className={styles.subjectTitle}>{subject.title}</h3>
                    {featured ? <span className={styles.subjectBody}>{subject.body}</span> : null}
                  </span>
                  {featured ? (
                    <span className={styles.subjectHighlights}>
                      {subject.highlights.map((highlight) => (
                        <span key={highlight}>{highlight}</span>
                      ))}
                    </span>
                  ) : null}
                  <span className={styles.subjectLink}>
                    <span className={styles.subjectLinkLabel}>{subject.cta.label}</span>
                    <ArrowRightIcon width={16} height={16} />
                  </span>
                </span>
                <span className={styles.subjectGlow} aria-hidden="true" />
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
}
