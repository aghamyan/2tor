import { NextResponse, type NextRequest } from "next/server";
import { ProjectError } from "../../../../../../../../packages/domain/projects/errors";
import { getDownloadableProjectFile } from "../../../../../../../../packages/domain/projects/services";
import {
  createS3ProjectStorage,
  verifyProjectFileSignedUrl,
} from "../../../../../../../../packages/domain/projects/storage";
import { apiProjectContext } from "../../../_context";
import { projectApiError, projectRequestId } from "../../../_response";

/** Rechecks session, signed URL, project membership, and scan status before private streaming. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const requestId = projectRequestId(request);
  try {
    const context = await apiProjectContext(request);
    const { fileId } = await params;
    const token = request.nextUrl.searchParams.get("token");
    if (!token || !verifyProjectFileSignedUrl(token, fileId, context.actor.userId))
      throw new ProjectError("FORBIDDEN", "The download URL is invalid or expired.", 403);
    const file = await getDownloadableProjectFile(context.database, context.actor, fileId);
    const object = await createS3ProjectStorage().getPrivate(file.fileKey);
    return new NextResponse(object.body, {
      headers: {
        "Content-Type": object.contentType ?? "application/octet-stream",
        "Content-Disposition": "attachment",
      },
    });
  } catch (error) {
    return projectApiError(error, requestId);
  }
}
