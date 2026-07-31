import { NextResponse, type NextRequest } from "next/server";
import {
  createAssessment,
  listAssessmentsForActor,
} from "../../../../../packages/domain/assessments/services";
import { apiAssessmentContext } from "./_context";
import { assessmentApiError, assessmentRequestId } from "./_response";

export async function GET(request: NextRequest) {
  const requestId = assessmentRequestId(request);
  try {
    const context = await apiAssessmentContext(request);
    const assessments = await listAssessmentsForActor(context.database, context.actor);
    return NextResponse.json({ data: assessments, requestId });
  } catch (error) {
    return assessmentApiError(error, requestId);
  }
}

export async function POST(request: NextRequest) {
  const requestId = assessmentRequestId(request);
  try {
    const context = await apiAssessmentContext(request);
    const assessment = await createAssessment(
      context.database,
      context.actor,
      await request.json(),
    );
    return NextResponse.json({ data: assessment, requestId }, { status: 201 });
  } catch (error) {
    return assessmentApiError(error, requestId);
  }
}
