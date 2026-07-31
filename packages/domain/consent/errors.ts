export const CONSENT_ERROR_CODES = [
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "STUDENT_NOT_FOUND",
  "PARENT_PROFILE_REQUIRED",
  "CONTACT_VERIFICATION_REQUIRED",
  "CONSENT_NOT_APPLICABLE",
  "CONSENT_METHOD_NOT_SUPPORTED",
  "CONSENT_VERIFICATION_FAILED",
  "CONSENT_REQUIRED",
  "FAMILY_NOT_READY",
  "ACCOUNT_SUSPENDED",
  "INVALID_INPUT",
] as const;

export type ConsentErrorCode = (typeof CONSENT_ERROR_CODES)[number];

export class ConsentError extends Error {
  readonly code: ConsentErrorCode;
  readonly status: number;

  constructor(code: ConsentErrorCode, message: string, status = 400) {
    super(message);
    this.name = "ConsentError";
    this.code = code;
    this.status = status;
  }
}

export function isConsentError(error: unknown): error is ConsentError {
  return error instanceof ConsentError;
}
