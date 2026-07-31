import { NextResponse } from "next/server";
import { z } from "zod";
import { isAcademicError } from "../../../../../packages/domain/academics/errors";
export function academicRequestId(request: Request) {
  return request.headers.get("x-request-id") ?? crypto.randomUUID();
}
export function academicApiError(error: unknown, requestId: string) {
  const status = error instanceof z.ZodError ? 400 : isAcademicError(error) ? error.status : 500;
  const code =
    error instanceof z.ZodError
      ? "INVALID_INPUT"
      : isAcademicError(error)
        ? error.code
        : "INTERNAL_ERROR";
  const message =
    error instanceof z.ZodError
      ? "The request body is invalid."
      : isAcademicError(error)
        ? error.message
        : "Academic operation failed.";
  return NextResponse.json({ error: { code, message, requestId } }, { status });
}
