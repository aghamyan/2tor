import { NextResponse } from "next/server";
import { z } from "zod";
import { isProjectError } from "../../../../../packages/domain/projects/errors";

export function projectRequestId(request: Request) {
  return request.headers.get("x-request-id") ?? crypto.randomUUID();
}
export function projectApiError(error: unknown, requestId: string) {
  const status = error instanceof z.ZodError ? 400 : isProjectError(error) ? error.status : 500;
  const code =
    error instanceof z.ZodError
      ? "INVALID_INPUT"
      : isProjectError(error)
        ? error.code
        : "INTERNAL_ERROR";
  const message =
    error instanceof z.ZodError
      ? "The request body is invalid."
      : isProjectError(error)
        ? error.message
        : "Project operation failed.";
  return NextResponse.json({ error: { code, message, requestId } }, { status });
}
