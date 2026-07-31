export const DISCUSSION_ERROR_CODES = [
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "INVALID_INPUT",
  "QUESTION_NOT_FOUND",
  "ANSWER_NOT_FOUND",
  "ATTACHMENT_NOT_FOUND",
  "DISPLAY_IDENTITY_UNAVAILABLE",
  "ANSWER_NOT_VERIFIABLE",
  "VOTE_LIMIT_REACHED",
  "FILE_NOT_READY",
  "UPLOAD_NOT_ALLOWED",
  "UPLOAD_TOO_LARGE",
  "UPLOAD_SIGNATURE_INVALID",
] as const;

export type DiscussionErrorCode = (typeof DISCUSSION_ERROR_CODES)[number];

export class DiscussionError extends Error {
  constructor(
    public readonly code: DiscussionErrorCode,
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "DiscussionError";
  }
}

export function isDiscussionError(error: unknown): error is DiscussionError {
  return error instanceof DiscussionError;
}
