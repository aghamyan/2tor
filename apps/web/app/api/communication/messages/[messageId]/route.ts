import { NextResponse, type NextRequest } from "next/server";

import { deleteMessage } from "../../../../../../../packages/domain/communication/services";
import { apiCommunicationContext } from "../../_context";
import { communicationApiError, communicationRequestId } from "../../_response";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> },
) {
  const requestId = communicationRequestId(request);
  try {
    const context = await apiCommunicationContext(request);
    const { messageId } = await params;
    await deleteMessage(context.database, context.actor, messageId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return communicationApiError(error, requestId);
  }
}
