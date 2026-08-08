export const DISCUSSION_ERROR_CODES = [
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "INVALID_INPUT",
  "QUESTION_NOT_FOUND",
  "ANSWER_NOT_FOUND",
  "ATTACHMENT_NOT_FOUND",
  "COMMENT_NOT_FOUND",
  "CORRECTION_NOT_FOUND",
  "RATING_NOT_FOUND",
  "REPORT_NOT_FOUND",
  "DISPLAY_IDENTITY_UNAVAILABLE",
  "ANSWER_NOT_VERIFIABLE",
  "ANSWER_NOT_RATEABLE",
  "VOTE_LIMIT_REACHED",
  "FILE_NOT_READY",
  "UPLOAD_NOT_ALLOWED",
  "UPLOAD_TOO_LARGE",
  "UPLOAD_SIGNATURE_INVALID",
  "QUESTION_LOCKED",
  "QUESTION_CLOSED",
  "DUPLICATE_RATING",
  "CANNOT_RATE_OWN_ANSWER",
  "CANNOT_VOTE_OWN_ANSWER",
  "CANNOT_ACCEPT_NOT_AUTHOR",
  "COMMENT_THREAD_TOO_DEEP",
  "RATE_LIMITED",
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
