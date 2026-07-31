import { NextResponse } from "next/server";
import { z } from "zod";
import { isContentError } from "../../../../../packages/domain/content/errors";
export function contentRequestId(request: Request) {
  return request.headers.get("x-request-id") ?? crypto.randomUUID();
}
export function contentApiError(error: unknown, requestId: string) {
  const status = error instanceof z.ZodError ? 400 : isContentError(error) ? error.status : 500;
  const code =
    error instanceof z.ZodError
      ? "INVALID_INPUT"
      : isContentError(error)
        ? error.code
        : "INTERNAL_ERROR";
  const message =
    error instanceof z.ZodError
      ? "The request body is invalid."
      : isContentError(error)
        ? error.message
        : "Content operation failed.";
  return NextResponse.json({ error: { code, message, requestId } }, { status });
}
