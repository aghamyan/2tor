import { SESSION_COOKIE_NAME } from "@app/auth";
import type { NextRequest } from "next/server";
import { assignmentRequestContext } from "../../../../../packages/domain/assignments/runtime";

export function apiAssignmentContext(request: NextRequest) {
  return assignmentRequestContext(request.cookies.get(SESSION_COOKIE_NAME)?.value);
}
