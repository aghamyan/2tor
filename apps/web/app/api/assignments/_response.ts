import { NextResponse } from "next/server";
import { z } from "zod";
import { isAssignmentError } from "../../../../../packages/domain/assignments/errors";

export function assignmentRequestId(request: Request) {
  return request.headers.get("x-request-id") ?? crypto.randomUUID();
}
export function assignmentApiError(error: unknown, requestId: string) {
  const status = error instanceof z.ZodError ? 400 : isAssignmentError(error) ? error.status : 500;
  const code =
    error instanceof z.ZodError
      ? "INVALID_INPUT"
      : isAssignmentError(error)
        ? error.code
        : "INTERNAL_ERROR";
  const message =
    error instanceof z.ZodError
      ? "The request body is invalid."
      : isAssignmentError(error)
        ? error.message
        : "Assignment operation failed.";
  return NextResponse.json({ error: { code, message, requestId } }, { status });
}
