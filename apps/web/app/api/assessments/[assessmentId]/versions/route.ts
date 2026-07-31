import { NextResponse, type NextRequest } from "next/server";
import { createVersionRequestSchema } from "../../../../../../../packages/domain/assessments/schemas";
import { addAssessmentVersion } from "../../../../../../../packages/domain/assessments/services";
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
    const values = createVersionRequestSchema.parse(await request.json());
    const version = await addAssessmentVersion(
      context.database,
      context.actor,
      assessmentId,
      values.version,
      values.publish,
    );
    return NextResponse.json({ data: version, requestId }, { status: 201 });
  } catch (error) {
    return assessmentApiError(error, requestId);
  }
}
