import { NextResponse, type NextRequest } from "next/server";
import { createProjectFileSignedUrl } from "../../../../../../../packages/domain/projects/storage";
import { getDownloadableProjectFile } from "../../../../../../../packages/domain/projects/services";
import { apiProjectContext } from "../../_context";
import { projectApiError, projectRequestId } from "../../_response";

/** A signed URL is issued only after membership/teaching authorization and a clean scan. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const requestId = projectRequestId(request);
  try {
    const context = await apiProjectContext(request);
    const { fileId } = await params;
    const file = await getDownloadableProjectFile(context.database, context.actor, fileId);
    return NextResponse.json({
      data: { ...file, downloadUrl: createProjectFileSignedUrl(file.id, context.actor.userId) },
      requestId,
    });
  } catch (error) {
    return projectApiError(error, requestId);
  }
}
