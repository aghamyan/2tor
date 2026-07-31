export const ADMINISTRATION_ERROR_CODES = [
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "NOT_FOUND",
  "INVALID_TRANSITION",
  "SELF_APPROVAL_FORBIDDEN",
  "STEP_UP_REQUIRED",
  "APPROVAL_NOT_FOUND",
  "APPROVAL_ALREADY_RESOLVED",
  "APPROVAL_ACTION_MISMATCH",
  "SELF_VERIFICATION_FORBIDDEN",
  "INVALID_INPUT",
] as const;

export type AdministrationErrorCode = (typeof ADMINISTRATION_ERROR_CODES)[number];

export class AdministrationError extends Error {
  readonly code: AdministrationErrorCode;
  readonly status: number;

  constructor(code: AdministrationErrorCode, message: string, status = 400) {
    super(message);
    this.name = "AdministrationError";
    this.code = code;
    this.status = status;
  }
}

export function isAdministrationError(error: unknown): error is AdministrationError {
  return error instanceof AdministrationError;
}
