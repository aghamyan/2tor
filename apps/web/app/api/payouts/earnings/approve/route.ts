import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { approveEarningEntries } from "../../../../../../../packages/domain/payouts/services";
import { apiPayoutContext } from "../../_context";
import { payoutApiError, requestId } from "../../_response";

const inputSchema = z.object({ entryIds: z.array(z.string().trim().min(1)).min(1) }).strict();

export async function POST(request: NextRequest) {
  const id = requestId(request);
  try {
    const context = await apiPayoutContext(request);
    const input = inputSchema.parse(await request.json());
    const entries = await approveEarningEntries(context.database, context.actor, input.entryIds);
    return NextResponse.json({ data: entries, requestId: id });
  } catch (error: unknown) {
    return payoutApiError(error, id);
  }
}
