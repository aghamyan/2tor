import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { requireIdempotencyKey } from "../../../../../../../packages/domain/payments/idempotency";
import { setDiscountActive } from "../../../../../../../packages/domain/payments/services";
import { apiPaymentContext } from "../../_context";
import { paymentApiError, paymentRequestId } from "../../_response";

const inputSchema = z.object({ active: z.boolean() }).strict();
const paramsSchema = z.object({ discountId: z.string().trim().min(1).max(128) }).strict();

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ discountId: string }> },
) {
  const requestId = paymentRequestId(request);
  try {
    const context = await apiPaymentContext(request);
    const { discountId } = paramsSchema.parse(await params);
    const input = inputSchema.parse(await request.json());
    await setDiscountActive(
      context.database,
      context.actor,
      discountId,
      input.active,
      requireIdempotencyKey(request.headers.get("idempotency-key")),
    );
    return NextResponse.json({ data: { id: discountId, active: input.active }, requestId });
  } catch (error: unknown) {
    return paymentApiError(error, requestId);
  }
}
