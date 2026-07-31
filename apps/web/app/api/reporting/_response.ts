import { NextResponse } from "next/server";
import { isReportingError } from "../../../../../packages/domain/reporting/errors";

export function reportingRequestId(request: Request): string {
  return request.headers.get("x-request-id") ?? crypto.randomUUID();
}

export function reportingApiError(error: unknown, requestId: string) {
  const status = isReportingError(error) ? error.status : 500;
  const code = isReportingError(error) ? error.code : "INTERNAL_ERROR";
  const message = isReportingError(error) ? error.message : "Reporting operation failed.";
  return NextResponse.json(
    { error: { code, message, requestId } },
    {
      status,
      headers: {
        "Cache-Control": "private, no-store",
        "Referrer-Policy": "no-referrer",
      },
    },
  );
}

export const reportingPrivacyHeaders = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "geolocation=(), camera=(), microphone=(), browsing-topics=()",
} as const;
