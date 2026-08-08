import {
  BookOpenCheck,
  CalendarDays,
  CircleCheck,
  Eye,
  MessageCircleMore,
  NotebookTabs,
  Target,
} from "lucide-react";
import type { ParentsCopy } from "./parents-content";
import styles from "./parents-page.module.css";

/**
 * The illustrative parent workspace.
 *
 * Its own module rather than a function inside `parents-page.tsx` because the home page renders it
 * too, and `home-sections.tsx` is a client component: importing it from the page file would drag
 * that whole file — the consultation flow, the tab widget, two dozen icons — into the client bundle
 * for the sake of one static mock. Nothing here is a hook, so it renders in either environment.
 *
 * A picture of the signed-in surface, not the surface itself: `components/dashboards/`
 * `parent-dashboard.tsx` reads live family data through server components and cannot appear on a
 * public page. The `illustrative` caption is part of the component for that reason — it is the line
 * that stops the sample data reading as somebody's real week.
 */
export function ParentDashboardPreview({
  c,
  id,
}: {
  c: ParentsCopy["dashboard"];
  /**
   * Only `/parents` passes one: its hero links to `#parent-workspace`. The home page renders the
   * same mock inside an `aria-hidden` picture, so an anchor there would resolve to content a reader
   * cannot reach.
   */
  id?: string;
}) {
  return (
    <div className={styles.dashboardFrame} id={id}>
      <div className={styles.dashboardTopbar}>
        <div className={styles.dashboardBrand} aria-hidden="true">
          2
        </div>
        <p>{c.greeting}</p>
        <span className={styles.dashboardAvatar}>A</span>
      </div>
      <div className={styles.dashboardBody}>
        <nav className={styles.dashboardNav} aria-label={c.label}>
          <span className={styles.dashboardNavActive}>
            <Eye /> {c.nav.overview}
          </span>
          <span>
            <CalendarDays /> {c.nav.classes}
          </span>
          <span>
            <NotebookTabs /> {c.nav.homework}
          </span>
          <span>
            <Target /> {c.nav.progress}
          </span>
          <span>
            <MessageCircleMore /> {c.nav.feedback}
          </span>
        </nav>
        <div className={styles.dashboardMain}>
          <div className={styles.dashboardTitleRow}>
            <div>
              <span>{c.learner}</span>
              <h3>{c.subject}</h3>
            </div>
            <span className={styles.attendancePill}>
              <CircleCheck /> {c.attendanceValue}
            </span>
          </div>
          <div className={styles.dashboardCardGrid}>
            <article className={styles.goalCard}>
              <span className={styles.cardIcon}>
                <Target />
              </span>
              <p>{c.currentGoal}</p>
              <strong>{c.goal}</strong>
              <div className={styles.skillProgress} aria-label={c.progressValue}>
                <span />
                <span />
                <span />
                <i />
                <i />
              </div>
              <small>{c.progressValue}</small>
            </article>
            <article>
              <span className={`${styles.cardIcon} ${styles.cardIconBlue}`}>
                <CalendarDays />
              </span>
              <p>{c.nextLesson}</p>
              <strong>{c.nextLessonValue}</strong>
              <small>{c.subject}</small>
            </article>
            <article>
              <span className={`${styles.cardIcon} ${styles.cardIconAmber}`}>
                <BookOpenCheck />
              </span>
              <p>{c.homework}</p>
              <strong>{c.homeworkValue}</strong>
              <small>{c.viewAssignment}</small>
            </article>
            <article className={styles.feedbackCard}>
              <div className={styles.feedbackCardHead}>
                <span className={`${styles.cardIcon} ${styles.cardIconCoral}`}>
                  <MessageCircleMore />
                </span>
                <div>
                  <p>{c.feedback}</p>
                  <small>{c.feedbackMeta}</small>
                </div>
              </div>
              <blockquote>{c.feedbackValue}</blockquote>
            </article>
          </div>
        </div>
      </div>
      <p className={styles.dashboardCaption}>{c.illustrative}</p>
    </div>
  );
}
