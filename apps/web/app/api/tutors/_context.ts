import { SESSION_COOKIE_NAME } from "@app/auth";
import type { NextRequest } from "next/server";

import { tutorRequestContext } from "../../../../../packages/domain/tutors/runtime";

export function apiTutorContext(request: NextRequest) {
  return tutorRequestContext(request.cookies.get(SESSION_COOKIE_NAME)?.value);
}
