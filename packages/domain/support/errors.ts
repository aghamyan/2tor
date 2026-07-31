export const SUPPORT_ERROR_CODES = [
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "STEP_UP_REQUIRED",
  "TICKET_NOT_FOUND",
  "INCIDENT_NOT_FOUND",
  "INTERNAL_COMMENT_FORBIDDEN",
  "DOCUMENTED_REVIEW_REQUIRED",
] as const;

export type SupportErrorCode = (typeof SUPPORT_ERROR_CODES)[number];

export class SupportError extends Error {
  constructor(
    public readonly code: SupportErrorCode,
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "SupportError";
  }
}

export function isSupportError(error: unknown): error is SupportError {
  return error instanceof SupportError;
}
