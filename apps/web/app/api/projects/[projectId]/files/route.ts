import { NextResponse, type NextRequest } from "next/server";
import { ProjectError } from "../../../../../../../packages/domain/projects/errors";
import { uploadProjectFile } from "../../../../../../../packages/domain/projects/services";
import { createS3ProjectStorage } from "../../../../../../../packages/domain/projects/storage";
import { apiProjectContext } from "../../_context";
import { projectApiError, projectRequestId } from "../../_response";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const requestId = projectRequestId(request);
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File))
      throw new ProjectError("INVALID_INPUT", "A project file is required.");
    const context = await apiProjectContext(request);
    const { projectId } = await params;
    const uploaded = await uploadProjectFile(
      context.database,
      createS3ProjectStorage(),
      context.actor,
      projectId,
      { fileName: file.name, mimeType: file.type, sizeBytes: file.size },
      new Uint8Array(await file.arrayBuffer()),
    );
    return NextResponse.json({ data: uploaded, requestId }, { status: 201 });
  } catch (error) {
    return projectApiError(error, requestId);
  }
}
