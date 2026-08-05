import { SESSION_COOKIE_NAME } from "@app/auth";
import { cookies } from "next/headers";

import { whatsappRequestContext } from "../../../../../packages/domain/whatsapp/runtime";

export async function currentWhatsAppContext() {
  const cookieStore = await cookies();
  return whatsappRequestContext(cookieStore.get(SESSION_COOKIE_NAME)?.value);
}
