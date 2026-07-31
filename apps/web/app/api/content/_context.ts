import { SESSION_COOKIE_NAME } from "@app/auth";
import type { NextRequest } from "next/server";
import { contentRequestContext } from "../../../../../packages/domain/content/runtime";
export function apiContentContext(request: NextRequest) {
  return contentRequestContext(request.cookies.get(SESSION_COOKIE_NAME)?.value);
}
