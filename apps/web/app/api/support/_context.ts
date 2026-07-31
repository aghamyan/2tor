import { SESSION_COOKIE_NAME } from "@app/auth";
import type { NextRequest } from "next/server";
import { supportRequestContext } from "../../../../../packages/domain/support/runtime";

export function apiSupportContext(request: NextRequest) {
  return supportRequestContext(request.cookies.get(SESSION_COOKIE_NAME)?.value);
}
