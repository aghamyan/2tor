import { NextResponse, type NextRequest } from "next/server";
import { saveAssessmentAnswer } from "../../../../../../../../../packages/domain/assessments/services";
import { apiAssessmentContext } from "../../../../_context";
import { assessmentApiError, assessmentRequestId } from "../../../../_response";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ attemptId: string; questionId: string }> },
) {
  const requestId = assessmentRequestId(request);
  try {
    const context = await apiAssessmentContext(request);
    const { attemptId, questionId } = await params;
    const answer = await saveAssessmentAnswer(
      context.database,
      context.actor,
      attemptId,
      questionId,
      await request.json(),
    );
    return NextResponse.json({ data: answer, requestId });
  } catch (error) {
    return assessmentApiError(error, requestId);
  }
}
