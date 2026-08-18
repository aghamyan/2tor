import { NextResponse, type NextRequest } from "next/server";
import { getDownloadableResourceUpload } from "../../../../../../../packages/domain/content/services";
import { createContentUploadSignedUrl } from "../../../../../../../packages/domain/content/storage";
import { apiContentContext } from "../../_context";
import { contentApiError, contentRequestId } from "../../_response";

/** Returns a new 60-second URL only after approval and the same visibility rule the library list uses. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ uploadId: string }> },
) {
  const requestId = contentRequestId(request);
  try {
    const context = await apiContentContext(request);
    const { uploadId } = await params;
    const upload = await getDownloadableResourceUpload(context.database, context.actor, uploadId);
    return NextResponse.json({
      data: { ...upload, downloadUrl: createContentUploadSignedUrl(upload.id, context.actor.userId) },
      requestId,
    });
  } catch (error) {
    return contentApiError(error, requestId);
  }
}
