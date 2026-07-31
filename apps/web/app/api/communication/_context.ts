import { SESSION_COOKIE_NAME } from "@app/auth";
import type { NextRequest } from "next/server";

import { communicationRequestContext } from "../../../../../packages/domain/communication/runtime";

export function apiCommunicationContext(request: NextRequest) {
  return communicationRequestContext(request.cookies.get(SESSION_COOKIE_NAME)?.value);
}
