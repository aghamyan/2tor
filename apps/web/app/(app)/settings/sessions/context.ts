import { getSession, SESSION_COOKIE_NAME } from "@app/auth";
import { cookies } from "next/headers";

import { sessionsDeps } from "./runtime";

/** Thrown when the request has no live session; callers redirect to `/login` on this (see `queries.ts`). */
export class SessionsUnauthenticatedError extends Error {
  constructor() {
    super("A session is required.");
    this.name = "SessionsUnauthenticatedError";
  }
}

export interface SessionsContext {
  userId: string;
  /** The session naming *this* request — the "this device" row in the list. */
  currentSessionId: string;
}

export async function currentSessionsContext(): Promise<SessionsContext> {
  const sessionId = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const session = sessionId ? await getSession(sessionsDeps().redis, sessionId) : null;
  if (!session) throw new SessionsUnauthenticatedError();
  return { userId: session.userId, currentSessionId: session.id };
}
