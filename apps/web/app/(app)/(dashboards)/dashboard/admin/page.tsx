import { Suspense } from "react";

import {
  AdminDashboard,
  AdminDashboardSignals,
} from "../../../../../components/dashboards/admin-dashboard";
import { DashboardSummaryFallback } from "../../../../../components/dashboards/dashboard-summary";
import { loadDashboardViewer } from "../../_lib/viewer";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const { panels } = await loadDashboardViewer("admin");
  return (
    <AdminDashboard
      panels={panels}
      summary={
        <Suspense fallback={<DashboardSummaryFallback />}>
          <AdminDashboardSignals />
        </Suspense>
      }
    />
  );
}
