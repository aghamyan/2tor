import { SESSION_COOKIE_NAME } from "@app/auth";
import type { NextRequest } from "next/server";
import { projectRequestContext } from "../../../../../packages/domain/projects/runtime";

export function apiProjectContext(request: NextRequest) {
  return projectRequestContext(request.cookies.get(SESSION_COOKIE_NAME)?.value);
}
