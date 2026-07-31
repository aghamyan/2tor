import { SESSION_COOKIE_NAME } from "@app/auth";
import { cookies } from "next/headers";

import { schedulingRequestContext } from "../../../../../packages/domain/scheduling/runtime";

export async function currentSchedulingContext() {
  const cookieStore = await cookies();
  return schedulingRequestContext(cookieStore.get(SESSION_COOKIE_NAME)?.value);
}
