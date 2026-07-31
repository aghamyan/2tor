import { ulid } from "ulid";

import { constantTimeEqual, hmacSha256Hex, randomToken, sha256Hex } from "./internal/crypto";
import { resolveSessionLifetimeMinutes, type Role } from "./rbac";

/**
 * Minimal subset of the `ioredis` client surface this module needs. Defined locally (not
 * imported from `ioredis`) because `packages/auth`'s package.json intentionally has no Redis
 * dependency — strict pnpm workspace isolation means only `argon2`/`ulid`/`zod` resolve inside
 * this package (verified: `packages/auth/node_modules` only symlinks those three). The concrete
 * client (ioredis, already a dependency of `@app/domain`/`apps/worker`) is constructed by the
 * consuming app and passed in here; any object satisfying this shape works, including a fake one
 * in tests. Method signatures match `ioredis`'s so a real `Redis` instance is assignable as-is.
 */
export interface RedisLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: "PX", durationMs: number): Promise<unknown>;
  del(...keys: string[]): Promise<number>;
  sadd(key: string, ...members: string[]): Promise<number>;
  srem(key: string, ...members: string[]): Promise<number>;
  smembers(key: string): Promise<string[]>;
}

export interface SessionRecord {
  id: string;
  userId: string;
  roles: Role[];
  /**
   * ISO timestamp of the most recent MFA verification for this session (login, or a later
   * step-up challenge — see `recordStepUpMfaVerification`), or `null` if MFA was never verified.
   * Feed this straight into `./authorize.ts`'s `Actor.mfaVerifiedAt` — do not treat it as a plain
   * "MFA satisfied" boolean, since step-up requires it to be *recent* (see
   * `isMfaFreshEnough`/`STEP_UP_FRESHNESS_MINUTES`), not merely set once at login.
   */
  mfaVerifiedAt: string | null;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  ipAddress: string | null;
  userAgent: string | null;
  /** Per-session secret CSRF tokens are derived from. Never sent to the client directly. */
  csrfSecret: string;
}

export const SESSION_COOKIE_NAME = "session_id";

export interface SessionCookieOptions {
  name: string;
  value: string;
  httpOnly: true;
  secure: true;
  sameSite: "lax";
  path: "/";
  /** Seconds. */
  maxAge: number;
}

function sessionKey(sessionId: string): string {
  return `session:${sessionId}`;
}

function userSessionsKey(userId: string): string {
  return `user_sessions:${userId}`;
}

function knownDevicesKey(userId: string): string {
  return `known_devices:${userId}`;
}

function buildCookie(sessionId: string, maxAgeSeconds: number): SessionCookieOptions {
  return {
    name: SESSION_COOKIE_NAME,
    value: sessionId,
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

/** Cookie descriptor that clears the session cookie on logout. */
export function buildExpiredSessionCookie(): SessionCookieOptions {
  return buildCookie("", 0);
}

export interface CreateSessionParams {
  userId: string;
  roles: Role[];
  /** Set to the login timestamp if MFA was verified during this login, otherwise `null`/omitted. */
  mfaVerifiedAt?: Date | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  now?: Date;
}

export interface CreatedSession {
  session: SessionRecord;
  cookie: SessionCookieOptions;
}

/**
 * Creates a session, stores it in Redis with a TTL equal to its absolute lifetime (see
 * `resolveSessionLifetimeMinutes` — shortest across the actor's roles, so an admin+parent user
 * still gets the shorter admin lifetime), and records it in the user's session set for
 * "log out all devices" / session listing.
 */
export async function createSession(
  redis: RedisLike,
  params: CreateSessionParams,
): Promise<CreatedSession> {
  const now = params.now ?? new Date();
  const lifetimeMinutes = resolveSessionLifetimeMinutes(params.roles);
  const ttlMs = lifetimeMinutes * 60_000;
  const expiresAt = new Date(now.getTime() + ttlMs);

  const session: SessionRecord = {
    id: ulid(),
    userId: params.userId,
    roles: params.roles,
    mfaVerifiedAt: params.mfaVerifiedAt ? params.mfaVerifiedAt.toISOString() : null,
    createdAt: now.toISOString(),
    lastSeenAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    ipAddress: params.ipAddress ?? null,
    userAgent: params.userAgent ?? null,
    csrfSecret: randomToken(32),
  };

  await redis.set(sessionKey(session.id), JSON.stringify(session), "PX", ttlMs);
  // Not atomic with the `set` above: if `sadd` fails after `set` succeeds, this session works
  // but won't be revoked by `revokeAllSessionsForUser`. Acceptable for MVP; a `multi()`/pipeline
  // on `RedisLike` would close the gap if it becomes a real concern.
  await redis.sadd(userSessionsKey(params.userId), session.id);

  return { session, cookie: buildCookie(session.id, Math.floor(ttlMs / 1000)) };
}

/**
 * Records a fresh MFA verification against an existing session — call this immediately after a
 * step-up TOTP/recovery code challenge succeeds, so `isMfaFreshEnough` in `./authorize.ts` starts
 * counting from "now," not from login time.
 */
export async function recordStepUpMfaVerification(
  redis: RedisLike,
  sessionId: string,
  now: Date = new Date(),
): Promise<void> {
  const session = await getSession(redis, sessionId);
  if (!session) return;

  const remainingMs = new Date(session.expiresAt).getTime() - now.getTime();
  if (remainingMs <= 0) return;

  session.mfaVerifiedAt = now.toISOString();
  await redis.set(sessionKey(sessionId), JSON.stringify(session), "PX", remainingMs);
}

/** Looks up a session by id. Returns `null` if it doesn't exist, has expired, or its stored value is corrupt. */
export async function getSession(
  redis: RedisLike,
  sessionId: string,
): Promise<SessionRecord | null> {
  const raw = await redis.get(sessionKey(sessionId));
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as SessionRecord;
  } catch {
    return null;
  }
}

/** Updates `lastSeenAt` without extending the session's absolute expiry. */
export async function touchSession(
  redis: RedisLike,
  sessionId: string,
  now: Date = new Date(),
): Promise<void> {
  const session = await getSession(redis, sessionId);
  if (!session) return;

  const remainingMs = new Date(session.expiresAt).getTime() - now.getTime();
  if (remainingMs <= 0) return;

  session.lastSeenAt = now.toISOString();
  await redis.set(sessionKey(sessionId), JSON.stringify(session), "PX", remainingMs);
}

/** Revokes a single session (used for ordinary logout). */
export async function revokeSession(redis: RedisLike, sessionId: string): Promise<void> {
  const session = await getSession(redis, sessionId);
  await redis.del(sessionKey(sessionId));
  if (session) {
    await redis.srem(userSessionsKey(session.userId), sessionId);
  }
}

/** "Log out all devices" (spec §12.1). */
export async function revokeAllSessionsForUser(redis: RedisLike, userId: string): Promise<void> {
  const sessionIds = await redis.smembers(userSessionsKey(userId));
  if (sessionIds.length > 0) {
    await redis.del(...sessionIds.map(sessionKey));
  }
  await redis.del(userSessionsKey(userId));
}

/** Lists a user's active sessions (for a "manage devices" screen). Skips ids whose Redis key already expired. */
export async function listSessionsForUser(
  redis: RedisLike,
  userId: string,
): Promise<SessionRecord[]> {
  const sessionIds = await redis.smembers(userSessionsKey(userId));
  const sessions = await Promise.all(sessionIds.map((id) => getSession(redis, id)));
  return sessions.filter((session): session is SessionRecord => session !== null);
}

/** Stable fingerprint for a device, from its IP + user agent. Not for security isolation — only for new-device detection. */
export function deviceFingerprint(ipAddress: string | null, userAgent: string | null): string {
  return sha256Hex(`${ipAddress ?? ""}|${userAgent ?? ""}`);
}

/** Spec §12.1 "new-device alerts for staff": true if this fingerprint hasn't been seen for this user before. */
export async function isNewDevice(
  redis: RedisLike,
  userId: string,
  fingerprint: string,
): Promise<boolean> {
  const known = await redis.smembers(knownDevicesKey(userId));
  return !known.includes(fingerprint);
}

/** Records a device fingerprint as known, so a later login from it doesn't re-trigger the alert. */
export async function rememberDevice(
  redis: RedisLike,
  userId: string,
  fingerprint: string,
): Promise<void> {
  await redis.sadd(knownDevicesKey(userId), fingerprint);
}

const CSRF_TOKEN_CONTEXT = "csrf-token-v1";

/**
 * Derives a CSRF token from the session's per-session secret (synchronizer-token pattern) — no
 * extra Redis round trip needed to verify, since the caller already has the `SessionRecord`.
 */
export function generateCsrfToken(session: Pick<SessionRecord, "id" | "csrfSecret">): string {
  return hmacSha256Hex(session.csrfSecret, `${CSRF_TOKEN_CONTEXT}:${session.id}`);
}

export function verifyCsrfToken(
  session: Pick<SessionRecord, "id" | "csrfSecret">,
  token: string,
): boolean {
  return constantTimeEqual(generateCsrfToken(session), token);
}
