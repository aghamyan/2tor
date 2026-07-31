import { getSession, SESSION_COOKIE_NAME, type SessionRecord } from "@app/auth";
import Redis from "ioredis";
import { cookies } from "next/headers";

let redisSingleton: Redis | undefined;

export function webRedis(): Redis {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL is required for authenticated navigation.");
  redisSingleton ??= new Redis(url, { maxRetriesPerRequest: 1 });
  return redisSingleton;
}

export async function currentSession(): Promise<SessionRecord | null> {
  const sessionId = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  return sessionId ? getSession(webRedis(), sessionId) : null;
}
