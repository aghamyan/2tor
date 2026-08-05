export const WHATSAPP_ERROR_CODES = [
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "STUDENT_NOT_FOUND",
  "CONSENT_REQUIRED",
  "GROUP_NOT_ENABLED",
  "NO_PARENT_LINKED",
  "NO_TUTOR_ASSIGNED",
  "INVALID_INPUT",
] as const;

export type WhatsAppErrorCode = (typeof WHATSAPP_ERROR_CODES)[number];

export class WhatsAppError extends Error {
  readonly code: WhatsAppErrorCode;
  readonly status: number;

  constructor(code: WhatsAppErrorCode, message: string, status = 400) {
    super(message);
    this.name = "WhatsAppError";
    this.code = code;
    this.status = status;
  }
}

export function isWhatsAppError(error: unknown): error is WhatsAppError {
  return error instanceof WhatsAppError;
}
