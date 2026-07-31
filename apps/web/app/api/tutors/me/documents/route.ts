import { NextResponse, type NextRequest } from "next/server";

import { documentUploadInputSchema } from "../../../../../../../packages/domain/tutors/schemas";
import { uploadTutorDocument } from "../../../../../../../packages/domain/tutors/services";
import {
  createS3TutorDocumentStorage,
  createTutorDocumentSignedUrl,
} from "../../../../../../../packages/domain/tutors/storage";
import { apiTutorContext } from "../../_context";
import { requestId, tutorApiError } from "../../_response";

export async function GET(request: NextRequest) {
  const id = requestId(request);
  try {
    const context = await apiTutorContext(request);
    const profile = await context.database.findTutorProfileByUserId(context.actor.userId);
    const documents = profile ? await context.database.listDocuments(profile.id) : [];
    return NextResponse.json({
      data: documents.map((document) => ({
        ...document,
        downloadUrl:
          document.status === "approved"
            ? createTutorDocumentSignedUrl(document.id, context.actor.userId)
            : null,
      })),
      requestId: id,
    });
  } catch (error: unknown) {
    return tutorApiError(error, id);
  }
}

export async function POST(request: NextRequest) {
  const id = requestId(request);
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new Error("A document file is required.");
    const input = documentUploadInputSchema.parse({
      type: form.get("type"),
      fileName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
    });
    const context = await apiTutorContext(request);
    const document = await uploadTutorDocument(
      context.database,
      createS3TutorDocumentStorage(),
      context.actor,
      input,
      new Uint8Array(await file.arrayBuffer()),
    );
    return NextResponse.json({ data: document, requestId: id }, { status: 201 });
  } catch (error: unknown) {
    return tutorApiError(error, id);
  }
}
