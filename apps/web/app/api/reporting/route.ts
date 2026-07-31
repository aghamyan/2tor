import { NextResponse, type NextRequest } from "next/server";
import {
  buildReportingSnapshot,
  requireReportingAccess,
} from "../../../../../packages/domain/reporting/services";
import { previousPeriod, reportKey } from "../../../../../packages/domain/reporting/periods";
import type { ReportingCadence } from "../../../../../packages/domain/reporting/models";
import { ReportingError } from "../../../../../packages/domain/reporting/errors";
import { apiReportingContext } from "./_context";
import { reportingApiError, reportingPrivacyHeaders, reportingRequestId } from "./_response";

export async function GET(request: NextRequest) {
  const requestId = reportingRequestId(request);
  try {
    const context = await apiReportingContext(request);
    requireReportingAccess(context.actor);
    const value = request.nextUrl.searchParams.get("cadence") ?? "monthly";
    if (value !== "weekly" && value !== "monthly") {
      throw new ReportingError("INVALID_CADENCE", "Cadence must be weekly or monthly.");
    }
    const cadence: ReportingCadence = value;
    const anchorValue = request.nextUrl.searchParams.get("anchor");
    const anchor = anchorValue ? new Date(anchorValue) : new Date();
    if (Number.isNaN(anchor.getTime())) {
      throw new ReportingError("INVALID_ANCHOR", "The report anchor is invalid.");
    }
    const period = previousPeriod(cadence, anchor);
    const stored = await context.repository.getStoredReport(reportKey(cadence, period));
    const report = stored ?? (await buildReportingSnapshot(context.repository, cadence, period));
    return NextResponse.json(
      { data: report, source: stored ? "scheduled" : "live", requestId },
      { headers: reportingPrivacyHeaders },
    );
  } catch (error) {
    return reportingApiError(error, requestId);
  }
}
