import { NextResponse, type NextRequest } from "next/server";
import {
  getAssessmentAttemptReview,
  getAssessmentSession,
} from "../../../../../../../packages/domain/assessments/services";
import { apiAssessmentContext } from "../../_context";
import { assessmentApiError, assessmentRequestId } from "../../_response";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> },
) {
  const requestId = assessmentRequestId(request);
  try {
    const context = await apiAssessmentContext(request);
    const { attemptId } = await params;
    const data =
      request.nextUrl.searchParams.get("view") === "review"
        ? await getAssessmentAttemptReview(context.database, context.actor, attemptId)
        : await getAssessmentSession(context.database, context.actor, attemptId);
    return NextResponse.json({ data, requestId });
  } catch (error) {
    return assessmentApiError(error, requestId);
  }
}
