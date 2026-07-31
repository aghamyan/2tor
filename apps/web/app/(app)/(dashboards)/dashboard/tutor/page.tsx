import { Suspense } from "react";

import { DashboardSummaryFallback } from "../../../../../components/dashboards/dashboard-summary";
import {
  TutorDashboard,
  TutorDashboardSignals,
} from "../../../../../components/dashboards/tutor-dashboard";
import { loadDashboardViewer } from "../../_lib/viewer";

export const dynamic = "force-dynamic";

export default async function TutorDashboardPage() {
  const { panels } = await loadDashboardViewer("tutor");
  return (
    <TutorDashboard
      panels={panels}
      summary={
        <Suspense fallback={<DashboardSummaryFallback />}>
          <TutorDashboardSignals />
        </Suspense>
      }
    />
  );
}
