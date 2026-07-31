import { NextResponse, type NextRequest } from "next/server";

import {
  createS3TutorDocumentStorage,
  verifyTutorDocumentSignedUrl,
} from "../../../../../../../../packages/domain/tutors/storage";
import { apiTutorContext } from "../../../_context";
import { requestId, tutorApiError } from "../../../_response";
import { TutorError } from "../../../../../../../../packages/domain/tutors/errors";

/** Validates both the active session and a short-lived HMAC URL before streaming a private object. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const id = requestId(request);
  try {
    const { documentId } = await params;
    const context = await apiTutorContext(request);
    const token = request.nextUrl.searchParams.get("token");
    if (!token || !verifyTutorDocumentSignedUrl(token, documentId, context.actor.userId))
      throw new TutorError("FORBIDDEN", "The download URL is invalid or expired.", 403);
    const document = await context.database.findDocument(documentId);
    const profile = await context.database.findTutorProfileByUserId(context.actor.userId);
    if (!document || !profile || document.tutorProfileId !== profile.id)
      throw new TutorError("DOCUMENT_NOT_FOUND", "Document was not found.", 404);
    if (document.status !== "approved")
      throw new TutorError(
        "DOCUMENT_NOT_READY",
        "Document is quarantined until it has been reviewed.",
        409,
      );
    const object = await createS3TutorDocumentStorage().getPrivate(document.fileKey);
    return new NextResponse(object.body, {
      headers: {
        "Content-Type": object.contentType ?? "application/octet-stream",
        "Content-Disposition": "attachment",
      },
    });
  } catch (error: unknown) {
    return tutorApiError(error, id);
  }
}
