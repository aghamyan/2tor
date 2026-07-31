import { NextResponse, type NextRequest } from "next/server";

import { sendMessageSchema } from "../../../../../../../../packages/domain/communication/schemas";
import { sendMessage } from "../../../../../../../../packages/domain/communication/services";
import { apiCommunicationContext } from "../../../_context";
import { communicationApiError, communicationRequestId } from "../../../_response";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  const requestId = communicationRequestId(request);
  try {
    const context = await apiCommunicationContext(request);
    const { conversationId } = await params;
    const data = await sendMessage(
      context.database,
      context.actor,
      conversationId,
      sendMessageSchema.parse(await request.json()),
    );
    return NextResponse.json({ data, requestId }, { status: 201 });
  } catch (error) {
    return communicationApiError(error, requestId);
  }
}
