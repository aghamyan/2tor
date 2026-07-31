import { SESSION_COOKIE_NAME } from "@app/auth";
import { cookies } from "next/headers";

import { paymentRequestContext } from "../../../../../packages/domain/payments/runtime";

export async function currentPaymentContext() {
  const cookieStore = await cookies();
  return paymentRequestContext(cookieStore.get(SESSION_COOKIE_NAME)?.value);
}
