import { SESSION_COOKIE_NAME } from "@app/auth";
import { cookies } from "next/headers";

import { consentRequestContext } from "../../../../../packages/domain/consent/runtime";

export async function currentConsentContext() {
  const cookieStore = await cookies();
  return consentRequestContext(cookieStore.get(SESSION_COOKIE_NAME)?.value);
}
