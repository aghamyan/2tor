import { NextResponse } from "next/server";
import { z } from "zod";

import { isPaymentError } from "../../../../../packages/domain/payments/errors";

export function paymentRequestId(request: Request): string {
  return request.headers.get("x-request-id") ?? crypto.randomUUID();
}

export function paymentApiError(error: unknown, requestId: string): NextResponse {
  const status = error instanceof z.ZodError ? 400 : isPaymentError(error) ? error.status : 500;
  const code =
    error instanceof z.ZodError
      ? "INVALID_INPUT"
      : isPaymentError(error)
        ? error.code
        : "INTERNAL_ERROR";
  const message =
    error instanceof z.ZodError
      ? "The payment request is invalid."
      : isPaymentError(error)
        ? error.message
        : "The payment operation failed.";
  return NextResponse.json({ error: { code, message, requestId } }, { status });
}
