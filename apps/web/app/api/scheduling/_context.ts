import { SESSION_COOKIE_NAME } from "@app/auth";
import type { NextRequest } from "next/server";

import { schedulingRequestContext } from "../../../../../packages/domain/scheduling/runtime";

export function apiSchedulingContext(request: NextRequest) {
  return schedulingRequestContext(request.cookies.get(SESSION_COOKIE_NAME)?.value);
}
