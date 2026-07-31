import { NextResponse } from "next/server";
import { z } from "zod";
import { isAssessmentError } from "../../../../../packages/domain/assessments/errors";

export function assessmentRequestId(request: Request) {
  return request.headers.get("x-request-id") ?? crypto.randomUUID();
}

export function assessmentApiError(error: unknown, requestId: string) {
  const status = error instanceof z.ZodError ? 400 : isAssessmentError(error) ? error.status : 500;
  const code =
    error instanceof z.ZodError
      ? "INVALID_INPUT"
      : isAssessmentError(error)
        ? error.code
        : "INTERNAL_ERROR";
  const message =
    error instanceof z.ZodError
      ? "The request body is invalid."
      : isAssessmentError(error)
        ? error.message
        : "Assessment operation failed.";
  return NextResponse.json({ error: { code, message, requestId } }, { status });
}
