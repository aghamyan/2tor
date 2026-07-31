import { SESSION_COOKIE_NAME } from "@app/auth";
import { cookies } from "next/headers";

import { familyRequestContext } from "../../../../../packages/domain/families/runtime";

export async function currentFamilyContext() {
  const cookieStore = await cookies();
  return familyRequestContext(cookieStore.get(SESSION_COOKIE_NAME)?.value);
}
