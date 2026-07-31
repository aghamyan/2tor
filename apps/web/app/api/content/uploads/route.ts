import { NextResponse, type NextRequest } from "next/server";
import { createS3SubmissionStorage } from "../../../../../../packages/domain/assignments/storage";
import { tutorUploadSchema } from "../../../../../../packages/domain/content/schemas";
import { uploadTutorMaterial } from "../../../../../../packages/domain/content/services";
import { apiContentContext } from "../_context";
import { contentApiError, contentRequestId } from "../_response";
export async function POST(request: NextRequest) {
  const requestId = contentRequestId(request);
  try {
    const context = await apiContentContext(request);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new Error("A file is required.");
    const values = tutorUploadSchema.parse({
      resourceId: form.get("resourceId") || null,
      fileName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      rightsConfirmed: form.get("rightsConfirmed") === "true",
    });
    const upload = await uploadTutorMaterial(
      context.database,
      createS3SubmissionStorage(),
      context.actor,
      values,
      new Uint8Array(await file.arrayBuffer()),
    );
    return NextResponse.json({ data: upload, requestId }, { status: 201 });
  } catch (error) {
    return contentApiError(error, requestId);
  }
}
