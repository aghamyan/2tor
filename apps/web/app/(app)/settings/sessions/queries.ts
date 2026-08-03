import { listSessionsForUser, type SessionRecord } from "@app/auth";
import { redirect } from "next/navigation";

import { currentSessionsContext, SessionsUnauthenticatedError } from "./context";
import { sessionsDeps } from "./runtime";

export interface SessionsListData {
  sessions: SessionRecord[];
  currentSessionId: string;
}

/** Most-recently-active first — the list a person scanning for "is that still open?" wants. */
function byMostRecentlyActive(a: SessionRecord, b: SessionRecord): number {
  return new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime();
}

export async function loadSessionsList(): Promise<SessionsListData> {
  try {
    const context = await currentSessionsContext();
    const sessions = await listSessionsForUser(sessionsDeps().redis, context.userId);
    return {
      sessions: [...sessions].sort(byMostRecentlyActive),
      currentSessionId: context.currentSessionId,
    };
  } catch (error) {
    if (error instanceof SessionsUnauthenticatedError) redirect("/login");
    throw error;
  }
}
