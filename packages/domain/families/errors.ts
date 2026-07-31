export const FAMILY_ERROR_CODES = [
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "PARENT_PROFILE_REQUIRED",
  "PARENT_PROFILE_EXISTS",
  "STUDENT_NOT_FOUND",
  "PARENT_NOT_FOUND",
  "USERNAME_TAKEN",
  "LINK_EXISTS",
  "LINK_NOT_FOUND",
  "LAST_PARENT_LINK",
  "STUDENT_ROLE_MISSING",
  "INVALID_INPUT",
] as const;

export type FamilyErrorCode = (typeof FAMILY_ERROR_CODES)[number];

export class FamilyError extends Error {
  readonly code: FamilyErrorCode;
  readonly status: number;

  constructor(code: FamilyErrorCode, message: string, status = 400) {
    super(message);
    this.name = "FamilyError";
    this.code = code;
    this.status = status;
  }
}

export function isFamilyError(error: unknown): error is FamilyError {
  return error instanceof FamilyError;
}
