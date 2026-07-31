import { Suspense } from "react";

import { DashboardSummaryFallback } from "../../../../../components/dashboards/dashboard-summary";
import {
  OlderStudentDashboard,
  StudentDashboardSignals,
  YoungerStudentDashboard,
} from "../../../../../components/dashboards/student-dashboard";
import { loadStudentDashboardViewer } from "../../_lib/viewer";

export const dynamic = "force-dynamic";

export default async function StudentDashboardPage() {
  const viewer = await loadStudentDashboardViewer();
  const summary = (
    <Suspense fallback={<DashboardSummaryFallback />}>
      <StudentDashboardSignals />
    </Suspense>
  );

  return viewer.experience === "younger" ? (
    <YoungerStudentDashboard
      panels={viewer.panels}
      preferredName={viewer.profile.preferredName}
      summary={summary}
    />
  ) : (
    <OlderStudentDashboard
      panels={viewer.panels}
      preferredName={viewer.profile.preferredName}
      summary={summary}
    />
  );
}
