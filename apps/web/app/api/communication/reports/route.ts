import { NextResponse, type NextRequest } from "next/server";

import { reportMessageSchema } from "../../../../../../packages/domain/communication/schemas";
import { reportMessage } from "../../../../../../packages/domain/communication/services";
import { apiCommunicationContext } from "../_context";
import { communicationApiError, communicationRequestId } from "../_response";

export async function POST(request: NextRequest) {
  const requestId = communicationRequestId(request);
  try {
    const context = await apiCommunicationContext(request);
    const data = await reportMessage(
      context.database,
      context.actor,
      reportMessageSchema.parse(await request.json()),
    );
    return NextResponse.json({ data, requestId }, { status: 201 });
  } catch (error) {
    return communicationApiError(error, requestId);
  }
}
