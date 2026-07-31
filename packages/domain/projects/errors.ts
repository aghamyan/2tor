export const PROJECT_ERROR_CODES = [
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "PROJECT_NOT_FOUND",
  "PROJECT_MEMBER_NOT_FOUND",
  "PROJECT_FILE_NOT_FOUND",
  "FILE_NOT_READY",
  "RUBRIC_NOT_FOUND",
  "PORTFOLIO_ITEM_NOT_FOUND",
  "PORTFOLIO_CONSENT_REQUIRED",
  "PORTFOLIO_NOT_PUBLIC",
  "INVALID_INPUT",
  "UPLOAD_NOT_ALLOWED",
  "UPLOAD_TOO_LARGE",
  "UPLOAD_SIGNATURE_INVALID",
] as const;

export type ProjectErrorCode = (typeof PROJECT_ERROR_CODES)[number];

export class ProjectError extends Error {
  constructor(
    public readonly code: ProjectErrorCode,
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "ProjectError";
  }
}

export function isProjectError(error: unknown): error is ProjectError {
  return error instanceof ProjectError;
}
