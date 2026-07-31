import { getSession, type Actor } from "@app/auth";
import { createDb, type Database } from "@app/db";
import Redis from "ioredis";

import { createDrizzleSchedulingDatabase } from "./drizzle-database";
import { SchedulingError } from "./errors";
import type { SchedulingDatabase } from "./models";

let databaseSingleton: Database | undefined;
let redisSingleton: Redis | undefined;

function database(): Database {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required for scheduling operations.");
  databaseSingleton ??= createDb(databaseUrl);
  return databaseSingleton;
}

function redis(): Redis {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) throw new Error("REDIS_URL is required for scheduling authentication.");
  redisSingleton ??= new Redis(redisUrl, {
    maxRetriesPerRequest: 1,
  });
  return redisSingleton;
}

export async function schedulingRequestContext(
  sessionId: string | null | undefined,
): Promise<{ actor: Actor; database: SchedulingDatabase }> {
  if (!sessionId) throw new SchedulingError("UNAUTHENTICATED", "A session is required.", 401);
  const session = await getSession(redis(), sessionId);
  if (!session) throw new SchedulingError("UNAUTHENTICATED", "The session is invalid.", 401);
  return {
    actor: {
      userId: session.userId,
      roles: session.roles,
      mfaVerifiedAt: session.mfaVerifiedAt ? new Date(session.mfaVerifiedAt) : null,
    },
    database: createDrizzleSchedulingDatabase(database()),
  };
}
