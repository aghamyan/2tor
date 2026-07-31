import { SESSION_COOKIE_NAME } from "@app/auth";
import { cookies } from "next/headers";

import { payoutRequestContext } from "../../../../../packages/domain/payouts/runtime";

export async function currentPayoutContext() {
  const cookieStore = await cookies();
  return payoutRequestContext(cookieStore.get(SESSION_COOKIE_NAME)?.value);
}
