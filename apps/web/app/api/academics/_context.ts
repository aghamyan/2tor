import { SESSION_COOKIE_NAME } from "@app/auth";
import type { NextRequest } from "next/server";
import { academicRequestContext } from "../../../../../packages/domain/academics/runtime";
export function apiAcademicContext(request: NextRequest) {
  return academicRequestContext(request.cookies.get(SESSION_COOKIE_NAME)?.value);
}
