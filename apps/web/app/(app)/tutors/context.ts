import { SESSION_COOKIE_NAME } from "@app/auth";
import { cookies } from "next/headers";

import { tutorRequestContext } from "../../../../../packages/domain/tutors/runtime";

export async function currentTutorContext() {
  const cookieStore = await cookies();
  return tutorRequestContext(cookieStore.get(SESSION_COOKIE_NAME)?.value);
}
