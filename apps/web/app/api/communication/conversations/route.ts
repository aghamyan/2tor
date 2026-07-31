import { NextResponse, type NextRequest } from "next/server";

import { createConversationSchema } from "../../../../../../packages/domain/communication/schemas";
import {
  createConversation,
  listConversations,
} from "../../../../../../packages/domain/communication/services";
import { apiCommunicationContext } from "../_context";
import { communicationApiError, communicationRequestId } from "../_response";

export async function GET(request: NextRequest) {
  const requestId = communicationRequestId(request);
  try {
    const context = await apiCommunicationContext(request);
    const data = await listConversations(context.database, context.actor, {
      cursor: request.nextUrl.searchParams.get("cursor"),
      limit: Number(request.nextUrl.searchParams.get("limit") ?? 25),
    });
    return NextResponse.json({ data, requestId });
  } catch (error) {
    return communicationApiError(error, requestId);
  }
}

export async function POST(request: NextRequest) {
  const requestId = communicationRequestId(request);
  try {
    const context = await apiCommunicationContext(request);
    const input = createConversationSchema.parse(await request.json());
    const data = await createConversation(context.database, context.actor, input);
    return NextResponse.json({ data, requestId }, { status: 201 });
  } catch (error) {
    return communicationApiError(error, requestId);
  }
}
