import { NextResponse, type NextRequest } from "next/server";

import { listTransactionsForActor } from "../../../../../../packages/domain/payments/services";
import { apiPaymentContext } from "../_context";
import { paymentApiError, paymentRequestId } from "../_response";

export async function GET(request: NextRequest) {
  const requestId = paymentRequestId(request);
  try {
    const context = await apiPaymentContext(request);
    const result = await listTransactionsForActor(context.database, context.actor, {
      cursor: request.nextUrl.searchParams.get("cursor"),
      limit: Number(request.nextUrl.searchParams.get("limit") ?? "25"),
    });
    return NextResponse.json({ data: result, requestId });
  } catch (error: unknown) {
    return paymentApiError(error, requestId);
  }
}
