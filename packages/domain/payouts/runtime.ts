import { getSession, type Actor } from "@app/auth";
import { createDb, type Database } from "@app/db";
import Redis from "ioredis";

import { createDrizzlePayoutDatabase } from "./drizzle-database";
import { PayoutError } from "./errors";
import type { PayoutDatabase } from "./models";

let databaseSingleton: Database | undefined;
let redisSingleton: Redis | undefined;

function database(): Database {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required for payout operations.");
  databaseSingleton ??= createDb(databaseUrl);
  return databaseSingleton;
}

function redis(): Redis {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) throw new Error("REDIS_URL is required for payout authentication.");
  redisSingleton ??= new Redis(redisUrl, { maxRetriesPerRequest: 1 });
  return redisSingleton;
}

export async function payoutRequestContext(
  sessionId: string | null | undefined,
): Promise<{ actor: Actor; database: PayoutDatabase }> {
  if (!sessionId) throw new PayoutError("UNAUTHENTICATED", "A session is required.", 401);
  const session = await getSession(redis(), sessionId);
  if (!session) throw new PayoutError("UNAUTHENTICATED", "The session is invalid.", 401);
  return {
    actor: {
      userId: session.userId,
      roles: session.roles,
      mfaVerifiedAt: session.mfaVerifiedAt ? new Date(session.mfaVerifiedAt) : null,
    },
    database: createDrizzlePayoutDatabase(database()),
  };
}
