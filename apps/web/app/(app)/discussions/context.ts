import { SESSION_COOKIE_NAME } from "@app/auth";
import { cookies } from "next/headers";

import { discussionRequestContext } from "../../../../../packages/domain/discussions/runtime";

export async function currentDiscussionContext() {
  const cookieStore = await cookies();
  return discussionRequestContext(cookieStore.get(SESSION_COOKIE_NAME)?.value);
}
