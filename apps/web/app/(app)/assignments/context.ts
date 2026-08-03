import { SESSION_COOKIE_NAME } from "@app/auth";
import { cookies } from "next/headers";

import { assignmentRequestContext } from "../../../../../packages/domain/assignments/runtime";

export async function currentAssignmentContext() {
  const cookieStore = await cookies();
  return assignmentRequestContext(cookieStore.get(SESSION_COOKIE_NAME)?.value);
}
