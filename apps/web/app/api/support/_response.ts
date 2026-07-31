import { NextResponse } from "next/server";
import { z } from "zod";
import { isSupportError } from "../../../../../packages/domain/support/errors";

export function supportRequestId(request: Request) {
  return request.headers.get("x-request-id") ?? crypto.randomUUID();
}
export function supportApiError(error: unknown, requestId: string) {
  const status = error instanceof z.ZodError ? 400 : isSupportError(error) ? error.status : 500;
  const code =
    error instanceof z.ZodError
      ? "INVALID_INPUT"
      : isSupportError(error)
        ? error.code
        : "INTERNAL_ERROR";
  const message =
    error instanceof z.ZodError
      ? "The request body is invalid."
      : isSupportError(error)
        ? error.message
        : "Support operation failed.";
  return NextResponse.json({ error: { code, message, requestId } }, { status });
}
