import { NextResponse, type NextRequest } from "next/server";

import { createPayoutBatchInputSchema } from "../../../../../../packages/domain/payouts/schemas";
import {
  createMonthlyPayoutBatch,
  listFinancePayoutBatches,
} from "../../../../../../packages/domain/payouts/services";
import { apiPayoutContext } from "../_context";
import { payoutApiError, requestId } from "../_response";

export async function GET(request: NextRequest) {
  const id = requestId(request);
  try {
    const context = await apiPayoutContext(request);
    const batches = await listFinancePayoutBatches(context.database, context.actor);
    return NextResponse.json({ data: batches, requestId: id });
  } catch (error: unknown) {
    return payoutApiError(error, id);
  }
}

export async function POST(request: NextRequest) {
  const id = requestId(request);
  try {
    const context = await apiPayoutContext(request);
    const input = createPayoutBatchInputSchema.parse(await request.json());
    const batch = await createMonthlyPayoutBatch(context.database, context.actor, input);
    return NextResponse.json({ data: batch, requestId: id }, { status: 201 });
  } catch (error: unknown) {
    return payoutApiError(error, id);
  }
}
