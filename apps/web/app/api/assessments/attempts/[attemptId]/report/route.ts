import { NextResponse, type NextRequest } from "next/server";
import { writeDiagnosticReport } from "../../../../../../../../packages/domain/assessments/services";
import { apiAssessmentContext } from "../../../_context";
import { assessmentApiError, assessmentRequestId } from "../../../_response";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> },
) {
  const requestId = assessmentRequestId(request);
  try {
    const context = await apiAssessmentContext(request);
    const { attemptId } = await params;
    const report = await writeDiagnosticReport(
      context.database,
      context.actor,
      attemptId,
      await request.json(),
    );
    return NextResponse.json({ data: report, requestId }, { status: 201 });
  } catch (error) {
    return assessmentApiError(error, requestId);
  }
}
