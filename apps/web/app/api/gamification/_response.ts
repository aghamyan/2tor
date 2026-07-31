import { NextResponse } from "next/server";
import { z } from "zod";
import { isGamificationError } from "../../../../../packages/domain/gamification/errors";

export function gamificationRequestId(request: Request) {
  return request.headers.get("x-request-id") ?? crypto.randomUUID();
}

export function gamificationApiError(error: unknown, requestId: string) {
  const status =
    error instanceof z.ZodError ? 400 : isGamificationError(error) ? error.status : 500;
  const code =
    error instanceof z.ZodError
      ? "INVALID_INPUT"
      : isGamificationError(error)
        ? error.code
        : "INTERNAL_ERROR";
  const message =
    error instanceof z.ZodError
      ? "The request body is invalid."
      : isGamificationError(error)
        ? error.message
        : "Gamification operation failed.";
  return NextResponse.json({ error: { code, message, requestId } }, { status });
}
