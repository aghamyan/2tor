import { NextResponse } from "next/server";
import { z } from "zod";

import { isCommunicationError } from "../../../../../packages/domain/communication/errors";

export function communicationRequestId(request: Request): string {
  return request.headers.get("x-request-id") ?? crypto.randomUUID();
}

export function communicationApiError(error: unknown, requestId: string) {
  const status =
    error instanceof z.ZodError ? 400 : isCommunicationError(error) ? error.status : 500;
  const code =
    error instanceof z.ZodError
      ? "INVALID_INPUT"
      : isCommunicationError(error)
        ? error.code
        : "INTERNAL_ERROR";
  const message =
    error instanceof z.ZodError
      ? "The request is invalid."
      : isCommunicationError(error)
        ? error.message
        : "Communication operation failed.";
  return NextResponse.json({ error: { code, message, requestId } }, { status });
}
