import { CalendarIcon, MilestoneIcon, NoteIcon, TrendIcon } from "./icons";
import type { Cta } from "./content";
import styles from "./home.module.css";

export interface ForParentsPoint {
  key: "schedule" | "feedback" | "milestones" | "progressTrend";
  title: string;
  body: string;
}

export interface ForParentsProps {
  eyebrow: string;
  title: string;
  description: string;
  points: readonly ForParentsPoint[];
  cta: Cta;
  previewLabel: string;
  previewHeadline: string;
  previewCaption: string;
}

const ICON_BY_KEY = {
  schedule: CalendarIcon,
  feedback: NoteIcon,
  milestones: MilestoneIcon,
  progressTrend: TrendIcon,
} as const;

export function ForParents({
  eyebrow,
  title,
  description,
  points,
  cta,
  previewLabel,
  previewHeadline,
  previewCaption,
}: ForParentsProps) {
  return (
    <section
      className={`${styles.section} ${styles.sectionMuted}`}
      aria-labelledby="for-parents-title"
    >
      <div className={styles.inner}>
        <div className={styles.parentsGrid}>
          <div>
            <p className={styles.eyebrow}>{eyebrow}</p>
            <h2 className={styles.sectionTitle} id="for-parents-title">
              {title}
            </h2>
            <p className={styles.sectionLede}>{description}</p>
            <ul className={styles.parentsList}>
              {points.map((point) => {
                const Icon = ICON_BY_KEY[point.key];
                return (
                  <li className={styles.parentsPoint} key={point.key}>
                    <Icon width={20} height={20} />
                    <span>
                      <span className={styles.parentsPointTitle}>{point.title}</span>
                      <br />
                      <span className={styles.parentsPointBody}>{point.body}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
            <div className={`${styles.ctaRow} ${styles.parentsCtaRow}`}>
              <a className={styles.ctaPrimary} href={cta.href}>
                {cta.label}
              </a>
            </div>
          </div>
          <div className={styles.dashboardPreview} aria-hidden="true">
            <div className={styles.dashboardPreviewHeader}>
              <span>{previewLabel}</span>
            </div>
            <p className={styles.heroVisualHeadline}>{previewHeadline}</p>
            <svg
              className={styles.dashboardTrend}
              viewBox="0 0 320 110"
              width="320"
              height="110"
              role="presentation"
            >
              <path
                d="M8 90 C 55 90, 55 68, 92 64 S 150 44, 180 46 S 240 22, 312 16"
                fill="none"
                stroke="hsl(var(--home-accent))"
                strokeWidth="3"
                strokeLinecap="round"
              />
              {[
                [8, 90],
                [92, 64],
                [180, 46],
                [312, 16],
              ].map(([cx, cy]) => (
                <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={5} fill="hsl(var(--home-accent))" />
              ))}
            </svg>
            <p className={styles.dashboardPreviewCaption}>{previewCaption}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
