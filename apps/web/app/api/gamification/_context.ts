import { SESSION_COOKIE_NAME } from "@app/auth";
import type { NextRequest } from "next/server";
import { gamificationRequestContext } from "../../../../../packages/domain/gamification/runtime";

export function apiGamificationContext(request: NextRequest) {
  return gamificationRequestContext(request.cookies.get(SESSION_COOKIE_NAME)?.value);
}
