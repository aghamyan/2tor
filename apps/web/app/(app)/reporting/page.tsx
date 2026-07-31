import { ReportingDashboard } from "../../../components/reporting/reporting-dashboard";
import { previousPeriod, reportKey } from "../../../../../packages/domain/reporting/periods";
import {
  buildReportingSnapshot,
  requireReportingAccess,
} from "../../../../../packages/domain/reporting/services";
import type { ReportingCadence } from "../../../../../packages/domain/reporting/models";
import { currentReportingContext } from "./context";

export const dynamic = "force-dynamic";

export default async function ReportingPage({
  searchParams,
}: {
  searchParams: Promise<{ cadence?: string }>;
}) {
  const { cadence: requestedCadence } = await searchParams;
  const cadence: ReportingCadence = requestedCadence === "weekly" ? "weekly" : "monthly";
  const context = await currentReportingContext();
  requireReportingAccess(context.actor);
  const period = previousPeriod(cadence);
  const stored = await context.repository.getStoredReport(reportKey(cadence, period));
  const report = stored ?? (await buildReportingSnapshot(context.repository, cadence, period));

  return <ReportingDashboard report={report} />;
}
