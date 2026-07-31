import { NextResponse, type NextRequest } from "next/server";
import { getDownloadableSubmissionFile } from "../../../../../../../packages/domain/assignments/services";
import { createSubmissionFileSignedUrl } from "../../../../../../../packages/domain/assignments/storage";
import { apiAssignmentContext } from "../../_context";
import { assignmentApiError, assignmentRequestId } from "../../_response";

/** Returns a new 60-second URL only after relationship authorization and a clean scan status. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const requestId = assignmentRequestId(request);
  try {
    const context = await apiAssignmentContext(request);
    const { fileId } = await params;
    const file = await getDownloadableSubmissionFile(context.database, context.actor, fileId);
    return NextResponse.json({
      data: { ...file, downloadUrl: createSubmissionFileSignedUrl(file.id, context.actor.userId) },
      requestId,
    });
  } catch (error) {
    return assignmentApiError(error, requestId);
  }
}
