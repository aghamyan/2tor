export const COMMUNICATION_ERROR_CODES = [
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "INVALID_INPUT",
  "CONVERSATION_NOT_FOUND",
  "MESSAGE_NOT_FOUND",
  "ATTACHMENT_NOT_FOUND",
  "PARENT_REQUIRED",
  "MEMBER_ROLE_MISMATCH",
  "STAFF_REASON_REQUIRED",
  "MESSAGE_APPEND_ONLY",
  "FILE_NOT_READY",
  "UPLOAD_NOT_ALLOWED",
  "UPLOAD_TOO_LARGE",
  "UPLOAD_SIGNATURE_INVALID",
] as const;

export type CommunicationErrorCode = (typeof COMMUNICATION_ERROR_CODES)[number];

export class CommunicationError extends Error {
  constructor(
    public readonly code: CommunicationErrorCode,
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "CommunicationError";
  }
}

export function isCommunicationError(error: unknown): error is CommunicationError {
  return error instanceof CommunicationError;
}
