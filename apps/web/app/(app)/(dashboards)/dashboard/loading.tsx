import { DashboardSummaryFallback } from "../../../../components/dashboards/dashboard-summary";
import styles from "../../../../components/dashboards/dashboard.module.css";

export default function DashboardLoading() {
  return (
    <div className={styles.shell} aria-busy="true" aria-label="Loading dashboard">
      <header className={styles.masthead}>
        <div className={styles.heading}>
          <p className={styles.eyebrow}>Dashboard</p>
          <h1>Loading your workspace</h1>
          <p className={styles.intro}>Your role-specific module surfaces are being assembled.</p>
        </div>
        <div className={styles.roleMark} aria-hidden="true">
          <span>16</span>
          <strong>Dashboard</strong>
        </div>
      </header>
      <section className={styles.summarySection}>
        <div className={styles.sectionLead}>
          <p>Now</p>
          <h2>Current signals</h2>
        </div>
        <DashboardSummaryFallback />
      </section>
    </div>
  );
}
