export const MATCHING_ERROR_CODES = [
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "STUDENT_NOT_FOUND",
  "TUTOR_NOT_FOUND",
  "ASSIGNMENT_NOT_FOUND",
  "REQUEST_NOT_FOUND",
  "INVALID_TRANSITION",
  "INVALID_INPUT",
] as const;

export type MatchingErrorCode = (typeof MATCHING_ERROR_CODES)[number];

export class MatchingError extends Error {
  readonly code: MatchingErrorCode;
  readonly status: number;

  constructor(code: MatchingErrorCode, message: string, status = 400) {
    super(message);
    this.name = "MatchingError";
    this.code = code;
    this.status = status;
  }
}

export function isMatchingError(error: unknown): error is MatchingError {
  return error instanceof MatchingError;
}
