import { NextResponse, type NextRequest } from "next/server";

import { completePayoutBatchInputSchema } from "../../../../../../../../packages/domain/payouts/schemas";
import { markExternalPayoutComplete } from "../../../../../../../../packages/domain/payouts/services";
import { apiPayoutContext } from "../../../_context";
import { payoutApiError, requestId } from "../../../_response";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ batchId: string }> },
) {
  const id = requestId(request);
  try {
    const context = await apiPayoutContext(request);
    const { batchId } = await params;
    const input = completePayoutBatchInputSchema.parse(await request.json());
    const batch = await markExternalPayoutComplete(context.database, context.actor, batchId, input);
    return NextResponse.json({ data: batch, requestId: id });
  } catch (error: unknown) {
    return payoutApiError(error, id);
  }
}
