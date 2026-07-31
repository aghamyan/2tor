import { Suspense } from "react";

import { DashboardSummaryFallback } from "../../../../../components/dashboards/dashboard-summary";
import {
  FinanceDashboard,
  FinanceDashboardSignals,
} from "../../../../../components/dashboards/finance-dashboard";
import { loadDashboardViewer } from "../../_lib/viewer";

export const dynamic = "force-dynamic";

export default async function FinanceDashboardPage() {
  const { panels } = await loadDashboardViewer("finance");
  return (
    <FinanceDashboard
      panels={panels}
      summary={
        <Suspense fallback={<DashboardSummaryFallback />}>
          <FinanceDashboardSignals />
        </Suspense>
      }
    />
  );
}
