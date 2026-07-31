import { NextResponse, type NextRequest } from "next/server";
import { recordAssessmentSignal } from "../../../../../../../../packages/domain/assessments/services";
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
    const recorded = await recordAssessmentSignal(
      context.database,
      context.actor,
      attemptId,
      await request.json(),
    );
    return NextResponse.json({ data: recorded, requestId }, { status: 201 });
  } catch (error) {
    return assessmentApiError(error, requestId);
  }
}
