import { NextResponse, type NextRequest } from "next/server";
import { addSupportCommentSchema } from "../../../../../../../../packages/domain/support/schemas";
import { addSupportComment } from "../../../../../../../../packages/domain/support/services";
import { apiSupportContext } from "../../../_context";
import { supportApiError, supportRequestId } from "../../../_response";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> },
) {
  const requestId = supportRequestId(request);
  try {
    const context = await apiSupportContext(request);
    const { ticketId } = await params;
    const data = await addSupportComment(
      context.database,
      context.actor,
      ticketId,
      addSupportCommentSchema.parse(await request.json()),
    );
    return NextResponse.json({ data, requestId }, { status: 201 });
  } catch (error) {
    return supportApiError(error, requestId);
  }
}
