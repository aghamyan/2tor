import { NextResponse, type NextRequest } from "next/server";
import {
  canManageAssessment,
  deleteAssessment,
  getAssessmentForActor,
} from "../../../../../../packages/domain/assessments/services";
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
    const canDelete = canManageAssessment(context.actor, assessment.assessment);
    return NextResponse.json({
      data: { assessment: assessment.assessment, version: safeVersion, canDelete },
      requestId,
    });
  } catch (error) {
    return assessmentApiError(error, requestId);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ assessmentId: string }> },
) {
  const requestId = assessmentRequestId(request);
  try {
    const context = await apiAssessmentContext(request);
    const { assessmentId } = await params;
    await deleteAssessment(context.database, context.actor, assessmentId);
    return NextResponse.json({ data: { id: assessmentId, status: "archived" }, requestId });
  } catch (error) {
    return assessmentApiError(error, requestId);
  }
}
