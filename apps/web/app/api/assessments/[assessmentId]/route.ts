import { NextResponse, type NextRequest } from "next/server";
import { getAssessmentForActor } from "../../../../../../packages/domain/assessments/services";
import { apiAssessmentContext } from "../_context";
import { assessmentApiError, assessmentRequestId } from "../_response";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ assessmentId: string }> },
) {
  const requestId = assessmentRequestId(request);
  try {
    const context = await apiAssessmentContext(request);
    const { assessmentId } = await params;
    const assessment = await getAssessmentForActor(context.database, context.actor, assessmentId);
    const { questions, ...versionMetadata } = assessment.version;
    const safeVersion = { ...versionMetadata, questionCount: questions.length };
    return NextResponse.json({
      data: { assessment: assessment.assessment, version: safeVersion },
      requestId,
    });
  } catch (error) {
    return assessmentApiError(error, requestId);
  }
}
