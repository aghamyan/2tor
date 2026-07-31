export class ReportingError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "ReportingError";
  }
}

export function isReportingError(error: unknown): error is ReportingError {
  return error instanceof ReportingError;
}
