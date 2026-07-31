import { SESSION_COOKIE_NAME } from "@app/auth";
import type { NextRequest } from "next/server";

import { consentRequestContext } from "../../../../../packages/domain/consent/runtime";

export function apiConsentContext(request: NextRequest) {
  return consentRequestContext(request.cookies.get(SESSION_COOKIE_NAME)?.value);
}
