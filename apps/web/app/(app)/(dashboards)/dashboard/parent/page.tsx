import { Suspense } from "react";

import {
  ParentDashboard,
  ParentDashboardFallback,
  ParentDashboardSignals,
} from "../../../../../components/dashboards/parent-dashboard";
import { loadDashboardViewer } from "../../_lib/viewer";

export const dynamic = "force-dynamic";

export default async function ParentDashboardPage() {
  const { panels } = await loadDashboardViewer("parent");
  return (
    <ParentDashboard
      panels={panels}
      summary={
        <Suspense fallback={<ParentDashboardFallback />}>
          <ParentDashboardSignals />
        </Suspense>
      }
    />
  );
}
