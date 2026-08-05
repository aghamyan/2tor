import { NextResponse, type NextRequest } from "next/server";
import {
  listAssessmentAttemptsForActor,
  startAssessmentAttempt,
} from "../../../../../../../packages/domain/assessments/services";
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

/** Tutor/staff-only: the "who finished, and was anything flagged" list for this assessment. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ assessmentId: string }> },
) {
  const requestId = assessmentRequestId(request);
  try {
    const context = await apiAssessmentContext(request);
    const { assessmentId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const limitParam = searchParams.get("limit");
    const page = await listAssessmentAttemptsForActor(context.database, context.actor, assessmentId, {
      cursor: searchParams.get("cursor"),
      limit: limitParam === null ? undefined : Number(limitParam),
    });
    return NextResponse.json({ data: page, requestId });
  } catch (error) {
    return assessmentApiError(error, requestId);
  }
}
