import { SESSION_COOKIE_NAME } from "@app/auth";
import type { NextRequest } from "next/server";
import { reportingRequestContext } from "../../../../../packages/domain/reporting/runtime";

export function apiReportingContext(request: NextRequest) {
  return reportingRequestContext(request.cookies.get(SESSION_COOKIE_NAME)?.value);
}
