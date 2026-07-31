import { NextResponse } from "next/server";
import { z } from "zod";

import { isTutorError } from "../../../../../packages/domain/tutors/errors";

export function requestId(request: Request): string {
  return request.headers.get("x-request-id") ?? crypto.randomUUID();
}

export function tutorApiError(error: unknown, id: string): NextResponse {
  if (error instanceof z.ZodError)
    return NextResponse.json(
      { error: { code: "INVALID_INPUT", message: "The request body is invalid.", requestId: id } },
      { status: 400 },
    );
  if (isTutorError(error))
    return NextResponse.json(
      { error: { code: error.code, message: error.message, requestId: id } },
      { status: error.status },
    );
  return NextResponse.json(
    { error: { code: "INTERNAL_ERROR", message: "Tutor operation failed.", requestId: id } },
    { status: 500 },
  );
}
