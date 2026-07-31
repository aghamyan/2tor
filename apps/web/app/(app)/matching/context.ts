import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME } from "@app/auth";

import { matchingRequestContext } from "../../../../../packages/domain/matching/runtime";

export async function currentMatchingContext() {
  const store = await cookies();
  return matchingRequestContext(store.get(SESSION_COOKIE_NAME)?.value);
}
