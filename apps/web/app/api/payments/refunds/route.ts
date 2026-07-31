import { NextResponse, type NextRequest } from "next/server";

import { requireIdempotencyKey } from "../../../../../../packages/domain/payments/idempotency";
import { createRefundSchema } from "../../../../../../packages/domain/payments/schemas";
import { requestRefund } from "../../../../../../packages/domain/payments/services";
import { apiPaymentContext } from "../_context";
import { paymentGateway } from "../_gateway";
import { paymentApiError, paymentRequestId } from "../_response";

export async function POST(request: NextRequest) {
  const requestId = paymentRequestId(request);
  try {
    const context = await apiPaymentContext(request);
    const idempotencyKey = requireIdempotencyKey(request.headers.get("idempotency-key"));
    const refund = await requestRefund(
      context.database,
      paymentGateway(),
      context.actor,
      createRefundSchema.parse(await request.json()),
      idempotencyKey,
    );
    return NextResponse.json({ data: refund, requestId }, { status: 202 });
  } catch (error: unknown) {
    return paymentApiError(error, requestId);
  }
}
