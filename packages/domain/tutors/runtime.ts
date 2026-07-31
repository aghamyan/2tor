import { getSession, type Actor } from "../../auth/src";
import { createDb, type Database } from "@app/db";
import Redis from "ioredis";

import { createDrizzleTutorDatabase } from "./drizzle-database";
import { TutorError } from "./errors";
import type { TutorDatabase } from "./models";

let databaseSingleton: Database | undefined;
let redisSingleton: Redis | undefined;

function database(): Database {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required for tutor operations.");
  databaseSingleton ??= createDb(databaseUrl);
  return databaseSingleton;
}

function redis(): Redis {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) throw new Error("REDIS_URL is required for tutor authentication.");
  redisSingleton ??= new Redis(redisUrl, { maxRetriesPerRequest: 1 });
  return redisSingleton;
}

export async function tutorRequestContext(
  sessionId: string | null | undefined,
): Promise<{ actor: Actor; database: TutorDatabase }> {
  if (!sessionId) throw new TutorError("UNAUTHENTICATED", "A session is required.", 401);
  const session = await getSession(redis(), sessionId);
  if (!session) throw new TutorError("UNAUTHENTICATED", "The session is invalid.", 401);
  return {
    actor: {
      userId: session.userId,
      roles: session.roles,
      mfaVerifiedAt: session.mfaVerifiedAt ? new Date(session.mfaVerifiedAt) : null,
    },
    database: createDrizzleTutorDatabase(database()),
  };
}
