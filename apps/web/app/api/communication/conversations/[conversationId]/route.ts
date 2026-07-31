import { NextResponse, type NextRequest } from "next/server";

import { getConversationForActor } from "../../../../../../../packages/domain/communication/services";
import { apiCommunicationContext } from "../../_context";
import { communicationApiError, communicationRequestId } from "../../_response";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  const requestId = communicationRequestId(request);
  try {
    const context = await apiCommunicationContext(request);
    const { conversationId } = await params;
    const data = await getConversationForActor(context.database, context.actor, conversationId, {
      cursor: request.nextUrl.searchParams.get("cursor"),
      limit: Number(request.nextUrl.searchParams.get("limit") ?? 50),
      staffReason: request.nextUrl.searchParams.get("staffReason"),
    });
    return NextResponse.json({ data, requestId });
  } catch (error) {
    return communicationApiError(error, requestId);
  }
}
