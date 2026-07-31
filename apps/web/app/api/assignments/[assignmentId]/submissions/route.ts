import { NextResponse, type NextRequest } from "next/server";
import { submissionAnswersSchema } from "../../../../../../../packages/domain/assignments/schemas";
import { saveSubmissionAnswers } from "../../../../../../../packages/domain/assignments/services";
import { apiAssignmentContext } from "../../_context";
import { assignmentApiError, assignmentRequestId } from "../../_response";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ assignmentId: string }> },
) {
  const requestId = assignmentRequestId(request);
  try {
    const context = await apiAssignmentContext(request);
    const { assignmentId } = await params;
    const submission = await saveSubmissionAnswers(
      context.database,
      context.actor,
      assignmentId,
      submissionAnswersSchema.parse(await request.json()),
    );
    return NextResponse.json({ data: submission, requestId }, { status: 201 });
  } catch (error) {
    return assignmentApiError(error, requestId);
  }
}
