import { NextResponse, type NextRequest } from "next/server";
import {
  getAssessmentAttemptReview,
  getAssessmentSession,
} from "../../../../../../../packages/domain/assessments/services";
import { createAssessmentEvidenceSignedUrl } from "../../../../../../../packages/domain/assessments/storage";
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
    if (request.nextUrl.searchParams.get("view") === "review") {
      const review = await getAssessmentAttemptReview(context.database, context.actor, attemptId);
      const data = {
        ...review,
        evidence: review.evidence.map((item) => ({
          ...item,
          downloadUrl: createAssessmentEvidenceSignedUrl(attemptId, item.id, context.actor.userId),
        })),
      };
      return NextResponse.json({ data, requestId });
    }
    const data = await getAssessmentSession(context.database, context.actor, attemptId);
    return NextResponse.json({ data, requestId });
  } catch (error) {
    return assessmentApiError(error, requestId);
  }
}
