export const SCHEDULING_ERROR_CODES = [
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "ASSIGNMENT_NOT_FOUND",
  "ASSIGNMENT_INACTIVE",
  "LESSON_NOT_FOUND",
  "LESSON_SERIES_NOT_FOUND",
  "LESSON_NOT_SCHEDULED",
  "LESSON_ALREADY_RESOLVED",
  "INVALID_INPUT",
  "ZOOM_PROVISION_FAILED",
] as const;

export type SchedulingErrorCode = (typeof SCHEDULING_ERROR_CODES)[number];

export class SchedulingError extends Error {
  readonly code: SchedulingErrorCode;
  readonly status: number;

  constructor(code: SchedulingErrorCode, message: string, status = 400) {
    super(message);
    this.name = "SchedulingError";
    this.code = code;
    this.status = status;
  }
}

export function isSchedulingError(error: unknown): error is SchedulingError {
  return error instanceof SchedulingError;
}
