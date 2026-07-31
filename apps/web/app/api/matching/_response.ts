import { NextResponse } from "next/server";
import { z } from "zod";

import { isMatchingError } from "../../../../../packages/domain/matching/errors";

export function requestId(request: Request): string {
  return request.headers.get("x-request-id") ?? crypto.randomUUID();
}

export function matchingApiError(error: unknown, id: string): NextResponse {
  if (error instanceof z.ZodError) {
    return NextResponse.json(
      { error: { code: "INVALID_INPUT", message: "The request body is invalid.", requestId: id } },
      { status: 400 },
    );
  }
  if (isMatchingError(error)) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message, requestId: id } },
      { status: error.status },
    );
  }
  return NextResponse.json(
    { error: { code: "INTERNAL_ERROR", message: "Matching operation failed.", requestId: id } },
    { status: 500 },
  );
}
