import { NextResponse, type NextRequest } from "next/server";
import { updateSupportTicketSchema } from "../../../../../../../packages/domain/support/schemas";
import {
  getSupportTicket,
  updateSupportTicket,
} from "../../../../../../../packages/domain/support/services";
import { apiSupportContext } from "../../_context";
import { supportApiError, supportRequestId } from "../../_response";

type Params = { params: Promise<{ ticketId: string }> };
export async function GET(request: NextRequest, { params }: Params) {
  const requestId = supportRequestId(request);
  try {
    const context = await apiSupportContext(request);
    const { ticketId } = await params;
    const data = await getSupportTicket(context.database, context.actor, ticketId);
    return NextResponse.json({ data, requestId });
  } catch (error) {
    return supportApiError(error, requestId);
  }
}
export async function PATCH(request: NextRequest, { params }: Params) {
  const requestId = supportRequestId(request);
  try {
    const context = await apiSupportContext(request);
    const { ticketId } = await params;
    const data = await updateSupportTicket(
      context.database,
      context.actor,
      ticketId,
      updateSupportTicketSchema.parse(await request.json()),
    );
    return NextResponse.json({ data, requestId });
  } catch (error) {
    return supportApiError(error, requestId);
  }
}
