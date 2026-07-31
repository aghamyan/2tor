export const PAYOUT_ERROR_CODES = [
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "TUTOR_PROFILE_REQUIRED",
  "EARNING_NOT_FOUND",
  "BATCH_NOT_FOUND",
  "EMPTY_BATCH",
  "DUPLICATE_BATCH",
  "FX_CURRENCY_MISMATCH",
  "RECONCILIATION_FAILED",
  "BATCH_ALREADY_COMPLETED",
  "EVIDENCE_REQUIRED",
  "INVALID_INPUT",
] as const;

export type PayoutErrorCode = (typeof PAYOUT_ERROR_CODES)[number];

export class PayoutError extends Error {
  readonly code: PayoutErrorCode;
  readonly status: number;

  constructor(code: PayoutErrorCode, message: string, status = 400) {
    super(message);
    this.name = "PayoutError";
    this.code = code;
    this.status = status;
  }
}

export function isPayoutError(error: unknown): error is PayoutError {
  return error instanceof PayoutError;
}
