import { SESSION_COOKIE_NAME } from "@app/auth";
import type { NextRequest } from "next/server";

import { paymentRequestContext } from "../../../../../packages/domain/payments/runtime";

export function apiPaymentContext(request: NextRequest) {
  return paymentRequestContext(request.cookies.get(SESSION_COOKIE_NAME)?.value);
}
