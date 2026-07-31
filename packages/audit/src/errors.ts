export const AUDIT_ERROR_CODES = [
  "INVALID_INPUT",
  "APPROVAL_NOT_FOUND",
  "SELF_APPROVAL_FORBIDDEN",
  "APPROVAL_ALREADY_RESOLVED",
] as const;

export type AuditErrorCode = (typeof AUDIT_ERROR_CODES)[number];

export class AuditError extends Error {
  readonly code: AuditErrorCode;
  readonly status: number;

  constructor(code: AuditErrorCode, message: string, status = 400) {
    super(message);
    this.name = "AuditError";
    this.code = code;
    this.status = status;
  }
}

export function isAuditError(error: unknown): error is AuditError {
  return error instanceof AuditError;
}
