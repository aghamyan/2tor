import { NextResponse, type NextRequest } from "next/server";

import { requireIdempotencyKey } from "../../../../../../packages/domain/payments/idempotency";
import { prepareInvoicePaymentSchema } from "../../../../../../packages/domain/payments/schemas";
import { prepareInvoicePayment } from "../../../../../../packages/domain/payments/services";
import { apiPaymentContext } from "../_context";
import { paymentGateway } from "../_gateway";
import { paymentApiError, paymentRequestId } from "../_response";

export async function POST(request: NextRequest) {
  const requestId = paymentRequestId(request);
  try {
    const context = await apiPaymentContext(request);
    const idempotencyKey = requireIdempotencyKey(request.headers.get("idempotency-key"));
    const input = prepareInvoicePaymentSchema.parse(await request.json());
    const result = await prepareInvoicePayment(
      context.database,
      paymentGateway(),
      context.actor,
      input,
      idempotencyKey,
    );
    return NextResponse.json({ data: result, requestId }, { status: 201 });
  } catch (error: unknown) {
    return paymentApiError(error, requestId);
  }
}
