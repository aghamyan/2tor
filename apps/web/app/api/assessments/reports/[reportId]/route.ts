import { NextResponse, type NextRequest } from "next/server";
import { getDiagnosticReportForActor } from "../../../../../../../packages/domain/assessments/services";
import { apiAssessmentContext } from "../../_context";
import { assessmentApiError, assessmentRequestId } from "../../_response";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ reportId: string }> },
) {
  const requestId = assessmentRequestId(request);
  try {
    const context = await apiAssessmentContext(request);
    const { reportId } = await params;
    const report = await getDiagnosticReportForActor(context.database, context.actor, reportId);
    return NextResponse.json({ data: report, requestId });
  } catch (error) {
    return assessmentApiError(error, requestId);
  }
}
