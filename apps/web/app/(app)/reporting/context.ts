import { SESSION_COOKIE_NAME } from "@app/auth";
import { cookies } from "next/headers";
import { reportingRequestContext } from "../../../../../packages/domain/reporting/runtime";

export async function currentReportingContext() {
  const store = await cookies();
  return reportingRequestContext(store.get(SESSION_COOKIE_NAME)?.value);
}
