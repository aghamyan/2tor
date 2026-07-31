import { SESSION_COOKIE_NAME } from "@app/auth";
import { cookies } from "next/headers";
import { academicRequestContext } from "../../../../../packages/domain/academics/runtime";
export async function currentAcademicContext() {
  const store = await cookies();
  return academicRequestContext(store.get(SESSION_COOKIE_NAME)?.value);
}
