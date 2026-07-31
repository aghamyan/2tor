import { NextResponse, type NextRequest } from "next/server";
import { gradeSubmissionSchema } from "../../../../../../../../packages/domain/assignments/schemas";
import { gradeSubmission } from "../../../../../../../../packages/domain/assignments/services";
import { apiAssignmentContext } from "../../../_context";
import { assignmentApiError, assignmentRequestId } from "../../../_response";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ submissionId: string }> },
) {
  const requestId = assignmentRequestId(request);
  try {
    const context = await apiAssignmentContext(request);
    const { submissionId } = await params;
    const grading = await gradeSubmission(
      context.database,
      context.actor,
      submissionId,
      gradeSubmissionSchema.parse(await request.json()),
    );
    return NextResponse.json({ data: grading, requestId }, { status: 201 });
  } catch (error) {
    return assignmentApiError(error, requestId);
  }
}
