export const PAYMENT_ERROR_CODES = [
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "INVALID_INPUT",
  "IDEMPOTENCY_KEY_REQUIRED",
  "PRICE_NOT_FOUND",
  "BILLING_PARENT_NOT_FOUND",
  "INVOICE_NOT_FOUND",
  "TRANSACTION_NOT_FOUND",
  "REFUND_EXCEEDS_AVAILABLE",
  "PAYMENT_NOT_READY",
] as const;

export type PaymentErrorCode = (typeof PAYMENT_ERROR_CODES)[number];

export class PaymentError extends Error {
  readonly code: PaymentErrorCode;
  readonly status: number;

  constructor(code: PaymentErrorCode, message: string, status = 400) {
    super(message);
    this.name = "PaymentError";
    this.code = code;
    this.status = status;
  }
}

export function isPaymentError(error: unknown): error is PaymentError {
  return error instanceof PaymentError;
}
