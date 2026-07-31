import { Suspense } from "react";

import {
  ParentDashboard,
  ParentDashboardSignals,
} from "../../../../../components/dashboards/parent-dashboard";
import { DashboardSummaryFallback } from "../../../../../components/dashboards/dashboard-summary";
import { loadDashboardViewer } from "../../_lib/viewer";

export const dynamic = "force-dynamic";

export default async function ParentDashboardPage() {
  const { panels } = await loadDashboardViewer("parent");
  return (
    <ParentDashboard
      panels={panels}
      summary={
        <Suspense fallback={<DashboardSummaryFallback />}>
          <ParentDashboardSignals />
        </Suspense>
      }
    />
  );
}
