export const ASSESSMENT_ERROR_CODES = [
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "ASSESSMENT_NOT_FOUND",
  "VERSION_NOT_FOUND",
  "ATTEMPT_NOT_FOUND",
  "QUESTION_NOT_FOUND",
  "REPORT_NOT_FOUND",
  "INVALID_INPUT",
  "ASSESSMENT_NOT_OPEN",
  "ATTEMPT_NOT_OPEN",
  "TIME_EXPIRED",
  "CAMERA_CONSENT_REQUIRED",
  "CAMERA_POLICY_MISMATCH",
  "HONOR_STATEMENT_REQUIRED",
  "CONSULTATION_REQUIRED",
  "REPORT_NOT_RELEASED",
] as const;

export type AssessmentErrorCode = (typeof ASSESSMENT_ERROR_CODES)[number];

export class AssessmentError extends Error {
  constructor(
    public readonly code: AssessmentErrorCode,
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "AssessmentError";
  }
}

export function isAssessmentError(error: unknown): error is AssessmentError {
  return error instanceof AssessmentError;
}
