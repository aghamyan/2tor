import { NextResponse, type NextRequest } from "next/server";
import { startAssessmentAttempt } from "../../../../../../../packages/domain/assessments/services";
import { apiAssessmentContext } from "../../_context";
import { assessmentApiError, assessmentRequestId } from "../../_response";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ assessmentId: string }> },
) {
  const requestId = assessmentRequestId(request);
  try {
    const context = await apiAssessmentContext(request);
    const { assessmentId } = await params;
    const session = await startAssessmentAttempt(
      context.database,
      context.actor,
      assessmentId,
      await request.json(),
    );
    return NextResponse.json({ data: session, requestId }, { status: 201 });
  } catch (error) {
    return assessmentApiError(error, requestId);
  }
}
