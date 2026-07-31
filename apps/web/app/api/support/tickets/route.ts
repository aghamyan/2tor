import { NextResponse, type NextRequest } from "next/server";
import { createSupportTicketSchema } from "../../../../../../packages/domain/support/schemas";
import {
  createSupportTicket,
  listSupportTickets,
} from "../../../../../../packages/domain/support/services";
import { supportSafetyEscalationHookFromEnvironment } from "../../../../../../packages/domain/support/runtime";
import { apiSupportContext } from "../_context";
import { supportApiError, supportRequestId } from "../_response";

export async function GET(request: NextRequest) {
  const requestId = supportRequestId(request);
  try {
    const context = await apiSupportContext(request);
    const limit = Number(request.nextUrl.searchParams.get("limit") ?? "100");
    const data = await listSupportTickets(
      context.database,
      context.actor,
      Number.isFinite(limit) ? limit : 100,
    );
    return NextResponse.json({ data, requestId });
  } catch (error) {
    return supportApiError(error, requestId);
  }
}
export async function POST(request: NextRequest) {
  const requestId = supportRequestId(request);
  try {
    const context = await apiSupportContext(request);
    const data = await createSupportTicket(
      context.database,
      context.actor,
      createSupportTicketSchema.parse(await request.json()),
      supportSafetyEscalationHookFromEnvironment(),
    );
    return NextResponse.json({ data, requestId }, { status: 201 });
  } catch (error) {
    return supportApiError(error, requestId);
  }
}
