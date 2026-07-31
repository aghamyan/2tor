export const CONTENT_ERROR_CODES = [
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "RESOURCE_NOT_FOUND",
  "RESOURCE_NOT_AVAILABLE",
  "INVALID_VIDEO_URL",
  "RIGHTS_CONFIRMATION_REQUIRED",
  "UPLOAD_NOT_ALLOWED",
  "UPLOAD_TOO_LARGE",
  "UPLOAD_SIGNATURE_INVALID",
] as const;
export type ContentErrorCode = (typeof CONTENT_ERROR_CODES)[number];
export class ContentError extends Error {
  constructor(
    public readonly code: ContentErrorCode,
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "ContentError";
  }
}
export function isContentError(error: unknown): error is ContentError {
  return error instanceof ContentError;
}
