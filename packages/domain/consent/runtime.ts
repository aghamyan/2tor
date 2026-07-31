import { getSession, type Actor } from "@app/auth";
import { createDb, type Database } from "@app/db";
import Redis from "ioredis";

import { createDrizzleFamilyDatabase } from "../families/drizzle-database";
import type { FamilyDatabase } from "../families/models";
import { createDrizzleConsentDatabase } from "./drizzle-database";
import { ConsentError } from "./errors";
import type { ConsentDatabase } from "./models";

let databaseSingleton: Database | undefined;
let redisSingleton: Redis | undefined;

function database(): Database {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required for consent operations.");
  databaseSingleton ??= createDb(databaseUrl);
  return databaseSingleton;
}

function redis(): Redis {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) throw new Error("REDIS_URL is required for consent authentication.");
  redisSingleton ??= new Redis(redisUrl, {
    maxRetriesPerRequest: 1,
  });
  return redisSingleton;
}

/**
 * The D1 (families) <-> D2 (consent) hand-off point: one shared `Database` connection backs both
 * a `ConsentDatabase` and a `FamilyDatabase`, so `services.ts` can call `familyReadyForActivation`
 * / `parentLinkedToStudent` against consistent state without either module reaching into the
 * other's tables directly.
 */
export async function consentRequestContext(
  sessionId: string | null | undefined,
): Promise<{ actor: Actor; database: ConsentDatabase; familyDatabase: FamilyDatabase }> {
  if (!sessionId) throw new ConsentError("UNAUTHENTICATED", "A session is required.", 401);
  const session = await getSession(redis(), sessionId);
  if (!session) throw new ConsentError("UNAUTHENTICATED", "The session is invalid.", 401);
  const db = database();
  return {
    actor: {
      userId: session.userId,
      roles: session.roles,
      mfaVerifiedAt: session.mfaVerifiedAt ? new Date(session.mfaVerifiedAt) : null,
    },
    database: createDrizzleConsentDatabase(db),
    familyDatabase: createDrizzleFamilyDatabase(db),
  };
}
