import { NextResponse, type NextRequest } from "next/server";
import { AssignmentError } from "../../../../../../../../packages/domain/assignments/errors";
import { getDownloadableSubmissionFile } from "../../../../../../../../packages/domain/assignments/services";
import {
  createS3SubmissionStorage,
  verifySubmissionFileSignedUrl,
} from "../../../../../../../../packages/domain/assignments/storage";
import { apiAssignmentContext } from "../../../_context";
import { assignmentApiError, assignmentRequestId } from "../../../_response";

/** Rechecks session, signed URL, assignment relationship, and scan status before streaming private storage. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const requestId = assignmentRequestId(request);
  try {
    const context = await apiAssignmentContext(request);
    const { fileId } = await params;
    const token = request.nextUrl.searchParams.get("token");
    if (!token || !verifySubmissionFileSignedUrl(token, fileId, context.actor.userId))
      throw new AssignmentError("FORBIDDEN", "The download URL is invalid or expired.", 403);
    const file = await getDownloadableSubmissionFile(context.database, context.actor, fileId);
    const object = await createS3SubmissionStorage().getPrivate(file.fileKey);
    return new NextResponse(object.body, {
      headers: {
        "Content-Type": object.contentType ?? "application/octet-stream",
        "Content-Disposition": "attachment",
      },
    });
  } catch (error) {
    return assignmentApiError(error, requestId);
  }
}
