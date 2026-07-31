import { NextResponse, type NextRequest } from "next/server";

import { CommunicationError } from "../../../../../../../../packages/domain/communication/errors";
import { getMessageAttachmentForActor } from "../../../../../../../../packages/domain/communication/services";
import {
  createS3CommunicationStorage,
  verifyMessageAttachmentSignedUrl,
} from "../../../../../../../../packages/domain/communication/storage";
import { apiCommunicationContext } from "../../../_context";
import { communicationApiError, communicationRequestId } from "../../../_response";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ attachmentId: string }> },
) {
  const requestId = communicationRequestId(request);
  try {
    const context = await apiCommunicationContext(request);
    const { attachmentId } = await params;
    const token = request.nextUrl.searchParams.get("token");
    if (!token || !verifyMessageAttachmentSignedUrl(token, attachmentId, context.actor.userId)) {
      throw new CommunicationError("FORBIDDEN", "The download URL is invalid or expired.", 403);
    }
    const storage = createS3CommunicationStorage();
    const attachment = await getMessageAttachmentForActor(
      context.database,
      context.actor,
      attachmentId,
      request.nextUrl.searchParams.get("staffReason"),
    );
    const object = await storage.getPrivate(attachment.fileKey);
    return new NextResponse(object.body, {
      headers: {
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`,
        "Content-Type": object.contentType ?? "application/octet-stream",
      },
    });
  } catch (error) {
    return communicationApiError(error, requestId);
  }
}
