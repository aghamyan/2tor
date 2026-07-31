import { SESSION_COOKIE_NAME } from "@app/auth";
import type { NextRequest } from "next/server";

import { administrationRequestContext } from "../../../../../packages/domain/administration/runtime";

export function apiAdministrationContext(request: NextRequest) {
  return administrationRequestContext(request.cookies.get(SESSION_COOKIE_NAME)?.value);
}
