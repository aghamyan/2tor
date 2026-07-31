import { SESSION_COOKIE_NAME } from "@app/auth";
import type { NextRequest } from "next/server";

import { payoutRequestContext } from "../../../../../packages/domain/payouts/runtime";

export function apiPayoutContext(request: NextRequest) {
  return payoutRequestContext(request.cookies.get(SESSION_COOKIE_NAME)?.value);
}
