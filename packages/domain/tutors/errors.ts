export const TUTOR_ERROR_CODES = [
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "TUTOR_PROFILE_REQUIRED",
  "TUTOR_PROFILE_EXISTS",
  "TUTOR_NOT_FOUND",
  "PUBLIC_PROFILE_NOT_FOUND",
  "INVALID_INPUT",
  "INVALID_UPLOAD",
  "DOCUMENT_NOT_FOUND",
  "DOCUMENT_NOT_READY",
  "SELF_VERIFICATION_FORBIDDEN",
] as const;

export type TutorErrorCode = (typeof TUTOR_ERROR_CODES)[number];

export class TutorError extends Error {
  readonly code: TutorErrorCode;
  readonly status: number;

  constructor(code: TutorErrorCode, message: string, status = 400) {
    super(message);
    this.name = "TutorError";
    this.code = code;
    this.status = status;
  }
}

export function isTutorError(error: unknown): error is TutorError {
  return error instanceof TutorError;
}
