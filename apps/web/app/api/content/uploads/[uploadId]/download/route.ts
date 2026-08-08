import { NextResponse, type NextRequest } from "next/server";
import { createS3SubmissionStorage } from "../../../../../../../../packages/domain/assignments/storage";
import { ContentError } from "../../../../../../../../packages/domain/content/errors";
import { getDownloadableResourceUpload } from "../../../../../../../../packages/domain/content/services";
import { verifyContentUploadSignedUrl } from "../../../../../../../../packages/domain/content/storage";
import { apiContentContext } from "../../../_context";
import { contentApiError, contentRequestId } from "../../../_response";

/** Rechecks session, signed URL, approval, and visibility before streaming private storage. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ uploadId: string }> },
) {
  const requestId = contentRequestId(request);
  try {
    const context = await apiContentContext(request);
    const { uploadId } = await params;
    const token = request.nextUrl.searchParams.get("token");
    if (!token || !verifyContentUploadSignedUrl(token, uploadId, context.actor.userId))
      throw new ContentError("FORBIDDEN", "The download URL is invalid or expired.", 403);
    const upload = await getDownloadableResourceUpload(context.database, context.actor, uploadId);
    if (!upload.fileKey) throw new ContentError("UPLOAD_NOT_FOUND", "Upload not found.", 404);
    const object = await createS3SubmissionStorage().getPrivate(upload.fileKey);
    return new NextResponse(object.body, {
      headers: {
        "Content-Type": object.contentType ?? upload.mimeType ?? "application/octet-stream",
        "Content-Disposition": `attachment; filename="${(upload.fileName ?? "file").replace(/"/g, "")}"`,
      },
    });
  } catch (error) {
    return contentApiError(error, requestId);
  }
}
