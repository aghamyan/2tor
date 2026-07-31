import { SESSION_COOKIE_NAME } from "@app/auth";
import type { NextRequest } from "next/server";

import { familyRequestContext } from "../../../../../packages/domain/families/runtime";

export function apiFamilyContext(request: NextRequest) {
  return familyRequestContext(request.cookies.get(SESSION_COOKIE_NAME)?.value);
}
