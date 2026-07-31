import { NextResponse, type NextRequest } from "next/server";
import { parsePrivacySafeFunnelEvent } from "../../../../../../packages/domain/reporting/privacy";
import { recordPrivacySafeFunnelEvent } from "../../../../../../packages/domain/reporting/services";
import { apiReportingContext } from "../_context";
import { reportingApiError, reportingPrivacyHeaders, reportingRequestId } from "../_response";

/**
 * Server-side/admin ingestion only. There is deliberately no browser beacon or child-area caller.
 * The payload is checked recursively before anything is persisted.
 */
export async function POST(request: NextRequest) {
  const requestId = reportingRequestId(request);
  try {
    const [context, body] = await Promise.all([apiReportingContext(request), request.json()]);
    const event = parsePrivacySafeFunnelEvent(body);
    await recordPrivacySafeFunnelEvent(context.repository, context.actor, event);
    return NextResponse.json(
      { data: { accepted: true }, requestId },
      { status: 202, headers: reportingPrivacyHeaders },
    );
  } catch (error) {
    return reportingApiError(error, requestId);
  }
}
