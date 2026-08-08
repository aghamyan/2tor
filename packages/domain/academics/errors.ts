export const ACADEMIC_ERROR_CODES = [
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "PLAN_NOT_FOUND",
  "VERSION_NOT_FOUND",
  "ACKNOWLEDGMENT_REQUIRED",
  "ACKNOWLEDGMENT_NOT_PENDING",
  "FEEDBACK_NOT_FOUND",
  "MILESTONE_NOT_FOUND",
  "EVIDENCE_REQUIRED",
  "INVALID_INPUT",
  "SKILL_NOT_FOUND",
] as const;

export type AcademicErrorCode = (typeof ACADEMIC_ERROR_CODES)[number];

export class AcademicError extends Error {
  constructor(
    readonly code: AcademicErrorCode,
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "AcademicError";
  }
}

export function isAcademicError(error: unknown): error is AcademicError {
  return error instanceof AcademicError;
}
