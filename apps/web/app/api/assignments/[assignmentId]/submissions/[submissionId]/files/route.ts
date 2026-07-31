import { NextResponse, type NextRequest } from "next/server";
import { uploadSubmissionFile } from "../../../../../../../../../packages/domain/assignments/services";
import { createS3SubmissionStorage } from "../../../../../../../../../packages/domain/assignments/storage";
import { apiAssignmentContext } from "../../../../_context";
import { assignmentApiError, assignmentRequestId } from "../../../../_response";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ submissionId: string }> },
) {
  const requestId = assignmentRequestId(request);
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new Error("A submission file is required.");
    const context = await apiAssignmentContext(request);
    const { submissionId } = await params;
    const uploaded = await uploadSubmissionFile(
      context.database,
      createS3SubmissionStorage(),
      context.actor,
      submissionId,
      { fileName: file.name, mimeType: file.type, sizeBytes: file.size },
      new Uint8Array(await file.arrayBuffer()),
    );
    return NextResponse.json({ data: uploaded, requestId }, { status: 201 });
  } catch (error) {
    return assignmentApiError(error, requestId);
  }
}
