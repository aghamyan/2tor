export const ASSIGNMENT_ERROR_CODES = [
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "ASSIGNMENT_NOT_FOUND",
  "SUBMISSION_NOT_FOUND",
  "FILE_NOT_FOUND",
  "FILE_NOT_READY",
  "INVALID_INPUT",
  "UPLOAD_NOT_ALLOWED",
  "UPLOAD_TOO_LARGE",
  "UPLOAD_SIGNATURE_INVALID",
  "ASSIGNMENT_NOT_OPEN",
  "RUBRIC_NOT_FOUND",
] as const;

export type AssignmentErrorCode = (typeof ASSIGNMENT_ERROR_CODES)[number];

export class AssignmentError extends Error {
  constructor(
    public readonly code: AssignmentErrorCode,
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "AssignmentError";
  }
}

export function isAssignmentError(error: unknown): error is AssignmentError {
  return error instanceof AssignmentError;
}
