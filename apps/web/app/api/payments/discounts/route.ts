import { NextResponse, type NextRequest } from "next/server";

import { requireIdempotencyKey } from "../../../../../../packages/domain/payments/idempotency";
import { createDiscountSchema } from "../../../../../../packages/domain/payments/schemas";
import { createDiscount } from "../../../../../../packages/domain/payments/services";
import { apiPaymentContext } from "../_context";
import { paymentApiError, paymentRequestId } from "../_response";

export async function POST(request: NextRequest) {
  const requestId = paymentRequestId(request);
  try {
    const context = await apiPaymentContext(request);
    const discount = await createDiscount(
      context.database,
      context.actor,
      createDiscountSchema.parse(await request.json()),
      requireIdempotencyKey(request.headers.get("idempotency-key")),
    );
    return NextResponse.json({ data: discount, requestId }, { status: 201 });
  } catch (error: unknown) {
    return paymentApiError(error, requestId);
  }
}
