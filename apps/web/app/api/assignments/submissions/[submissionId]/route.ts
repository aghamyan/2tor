import { NextResponse, type NextRequest } from "next/server";
import { getSubmissionForActor } from "../../../../../../../packages/domain/assignments/services";
import { apiAssignmentContext } from "../../_context";
import { assignmentApiError, assignmentRequestId } from "../../_response";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ submissionId: string }> },
) {
  const requestId = assignmentRequestId(request);
  try {
    const context = await apiAssignmentContext(request);
    const { submissionId } = await params;
    const submission = await getSubmissionForActor(context.database, context.actor, submissionId);
    return NextResponse.json({ data: submission, requestId });
  } catch (error) {
    return assignmentApiError(error, requestId);
  }
}
