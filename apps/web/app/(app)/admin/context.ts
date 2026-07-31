import { SESSION_COOKIE_NAME } from "@app/auth";
import { cookies } from "next/headers";

import { administrationRequestContext } from "../../../../../packages/domain/administration/runtime";

export async function currentAdministrationContext() {
  const store = await cookies();
  return administrationRequestContext(store.get(SESSION_COOKIE_NAME)?.value);
}
