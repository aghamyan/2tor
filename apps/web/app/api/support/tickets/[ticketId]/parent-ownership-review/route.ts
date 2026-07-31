import { NextResponse, type NextRequest } from "next/server";
import { parentOwnershipReviewSchema } from "../../../../../../../../packages/domain/support/schemas";
import { documentParentOwnershipReview } from "../../../../../../../../packages/domain/support/services";
import { apiSupportContext } from "../../../_context";
import { supportApiError, supportRequestId } from "../../../_response";

/** Family ownership workflows call this before attempting any ownership mutation. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> },
) {
  const requestId = supportRequestId(request);
  try {
    const context = await apiSupportContext(request);
    const { ticketId } = await params;
    const data = await documentParentOwnershipReview(
      context.database,
      context.actor,
      ticketId,
      parentOwnershipReviewSchema.parse(await request.json()),
    );
    return NextResponse.json({ data, requestId }, { status: 201 });
  } catch (error) {
    return supportApiError(error, requestId);
  }
}
