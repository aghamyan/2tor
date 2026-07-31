import { SESSION_COOKIE_NAME } from "@app/auth";
import type { NextRequest } from "next/server";

import { matchingRequestContext } from "../../../../../packages/domain/matching/runtime";

export function apiMatchingContext(request: NextRequest) {
  return matchingRequestContext(request.cookies.get(SESSION_COOKIE_NAME)?.value);
}
