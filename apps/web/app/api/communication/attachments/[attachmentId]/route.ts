import { NextResponse, type NextRequest } from "next/server";

import { getMessageAttachmentForActor } from "../../../../../../../packages/domain/communication/services";
import { createMessageAttachmentSignedUrl } from "../../../../../../../packages/domain/communication/storage";
import { apiCommunicationContext } from "../../_context";
import { communicationApiError, communicationRequestId } from "../../_response";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ attachmentId: string }> },
) {
  const requestId = communicationRequestId(request);
  try {
    const context = await apiCommunicationContext(request);
    const { attachmentId } = await params;
    const staffReason = request.nextUrl.searchParams.get("staffReason");
    const attachment = await getMessageAttachmentForActor(
      context.database,
      context.actor,
      attachmentId,
      staffReason,
    );
    const baseUrl = createMessageAttachmentSignedUrl(attachment.id, context.actor.userId);
    const downloadUrl = staffReason
      ? `${baseUrl}&staffReason=${encodeURIComponent(staffReason)}`
      : baseUrl;
    return NextResponse.json({ data: { ...attachment, downloadUrl }, requestId });
  } catch (error) {
    return communicationApiError(error, requestId);
  }
}
