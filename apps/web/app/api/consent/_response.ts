import { NextResponse } from "next/server";
import { z } from "zod";

import { ConsentError, isConsentError } from "../../../../../packages/domain/consent/errors";

export function requestId(request: Request): string {
  return request.headers.get("x-request-id") ?? crypto.randomUUID();
}

export function consentApiError(error: unknown, id: string): NextResponse {
  if (error instanceof z.ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_INPUT",
          message: "The request body is invalid.",
          requestId: id,
        },
      },
      { status: 400 },
    );
  }
  if (isConsentError(error)) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          requestId: id,
        },
      },
      { status: error.status },
    );
  }
  const internal = new ConsentError("INVALID_INPUT", "Consent operation failed.", 500);
  return NextResponse.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: internal.message,
        requestId: id,
      },
    },
    { status: 500 },
  );
}
