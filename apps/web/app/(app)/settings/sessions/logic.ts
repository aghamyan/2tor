import { getSession, revokeAllSessionsForUser, revokeSession, type RedisLike } from "@app/auth";

export type RevokeSessionOutcome = "revoked" | "not_found_or_forbidden";

/**
 * Revokes one *other* session, owned by the same user who's asking — `@app/auth`'s own
 * `revokeSession` deletes by id with no ownership check (it's built for the caller's own logout,
 * where the id always names the caller's session), so this task's own settings-page authorization
 * check (CONVENTIONS.md: "every protected operation performs a server-side authorization check")
 * happens here: a user may not revoke a session that isn't theirs, and a missing/already-gone
 * session id is indistinguishable from "not yours" in the response, so as not to confirm or deny
 * another user's session ids exist.
 */
export async function performRevokeSession(
  redis: RedisLike,
  input: { targetSessionId: string; actorUserId: string },
): Promise<RevokeSessionOutcome> {
  const target = await getSession(redis, input.targetSessionId);
  if (!target || target.userId !== input.actorUserId) return "not_found_or_forbidden";
  await revokeSession(redis, input.targetSessionId);
  return "revoked";
}

export interface RevokeAllDevicesAuditPort {
  recordLogoutAllDevices(input: { userId: string; ipAddress: string | null }): Promise<void>;
}

export interface RevokeAllDevicesDeps {
  redis: RedisLike;
  audit: RevokeAllDevicesAuditPort;
}

/**
 * "Log out of all devices" (task requirement #10/#11): invalidates every session for the user,
 * including the one making this request — `@app/auth` has no "revoke all *others*" primitive (see
 * this task's output notes), so the caller (`actions.ts`) also clears its own cookie and redirects
 * to `/signed-out`, same as an ordinary logout would.
 */
export async function performRevokeAllDevices(
  deps: RevokeAllDevicesDeps,
  input: { userId: string; ipAddress: string | null },
): Promise<void> {
  await revokeAllSessionsForUser(deps.redis, input.userId);
  await deps.audit.recordLogoutAllDevices({ userId: input.userId, ipAddress: input.ipAddress });
}
