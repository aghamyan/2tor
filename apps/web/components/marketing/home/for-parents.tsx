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
  previewWeek: string;
  previewLessons: string;
  previewMilestones: string;
  previewProjects: string;
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
  previewWeek,
  previewLessons,
  previewMilestones,
  previewProjects,
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
                    <span className={styles.parentsPointTitle}>{point.title}</span>
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
              <span className={styles.previewWeek}>{previewWeek}</span>
            </div>
            <div className={styles.dashboardMetric}>
              <div>
                <p className={styles.heroVisualHeadline}>{previewHeadline}</p>
                <strong>78%</strong>
              </div>
              <span>↗ 12%</span>
            </div>
            <div className={styles.chartShell}>
              <span className={styles.chartLine} />
              <svg className={styles.dashboardTrend} viewBox="0 0 360 140" role="presentation">
                <defs>
                  <linearGradient id="dashboard-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="hsl(var(--home-blue))" stopOpacity=".24" />
                    <stop offset="1" stopColor="hsl(var(--home-blue))" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  d="M3 122 C 52 118, 55 97, 94 100 S 147 62, 185 72 S 245 52, 276 47 S 323 21, 357 17 L357 140 L3 140 Z"
                  fill="url(#dashboard-fill)"
                />
                <path
                  d="M3 122 C 52 118, 55 97, 94 100 S 147 62, 185 72 S 245 52, 276 47 S 323 21, 357 17"
                  fill="none"
                  stroke="hsl(var(--home-blue))"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
                <circle cx="357" cy="17" r="6" fill="hsl(var(--home-blue))" />
              </svg>
            </div>
            <div className={styles.previewStats}>
              <span>
                <b>12</b> {previewLessons}
              </span>
              <span>
                <b>4</b> {previewMilestones}
              </span>
              <span>
                <b>2</b> {previewProjects}
              </span>
            </div>
            <p className={styles.dashboardPreviewCaption}>{previewCaption}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
