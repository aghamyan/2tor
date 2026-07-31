import { SESSION_COOKIE_NAME } from "@app/auth";
import type { NextRequest } from "next/server";
import { assessmentRequestContext } from "../../../../../packages/domain/assessments/runtime";

export function apiAssessmentContext(request: NextRequest) {
  return assessmentRequestContext(request.cookies.get(SESSION_COOKIE_NAME)?.value);
}
