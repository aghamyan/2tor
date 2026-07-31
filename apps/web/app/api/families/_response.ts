import { NextResponse } from "next/server";
import { z } from "zod";

import { FamilyError, isFamilyError } from "../../../../../packages/domain/families/errors";

export function requestId(request: Request): string {
  return request.headers.get("x-request-id") ?? crypto.randomUUID();
}

export function familyApiError(error: unknown, id: string): NextResponse {
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
  if (isFamilyError(error)) {
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
  const internal = new FamilyError("INVALID_INPUT", "Family operation failed.", 500);
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
