import { getSession, type Actor } from "@app/auth";
import { createDb, type Database } from "@app/db";
import Redis from "ioredis";

import { createDrizzleConsentDatabase } from "../consent/drizzle-database";
import type { ConsentDatabase } from "../consent/models";
import { createDrizzleFamilyDatabase } from "../families/drizzle-database";
import type { FamilyDatabase } from "../families/models";
import { createDrizzleWhatsAppDatabase } from "./drizzle-database";
import { WhatsAppError } from "./errors";
import type { WhatsAppDatabase } from "./models";

let databaseSingleton: Database | undefined;
let redisSingleton: Redis | undefined;

function database(): Database {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required for WhatsApp operations.");
  databaseSingleton ??= createDb(databaseUrl);
  return databaseSingleton;
}

function redis(): Redis {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) throw new Error("REDIS_URL is required for WhatsApp authentication.");
  redisSingleton ??= new Redis(redisUrl, {
    maxRetriesPerRequest: 1,
  });
  return redisSingleton;
}

/**
 * One shared `Database` connection backs a `WhatsAppDatabase`, a `FamilyDatabase` (for the
 * parent-link authorization check), and a `ConsentDatabase` (for the `includeChild` gate) — same
 * hand-off shape as `packages/domain/consent/runtime.ts`.
 */
export async function whatsappRequestContext(
  sessionId: string | null | undefined,
): Promise<{
  actor: Actor;
  database: WhatsAppDatabase;
  familyDatabase: FamilyDatabase;
  consentDatabase: ConsentDatabase;
}> {
  if (!sessionId) throw new WhatsAppError("UNAUTHENTICATED", "A session is required.", 401);
  const session = await getSession(redis(), sessionId);
  if (!session) throw new WhatsAppError("UNAUTHENTICATED", "The session is invalid.", 401);
  const db = database();
  return {
    actor: {
      userId: session.userId,
      roles: session.roles,
      mfaVerifiedAt: session.mfaVerifiedAt ? new Date(session.mfaVerifiedAt) : null,
    },
    database: createDrizzleWhatsAppDatabase(db),
    familyDatabase: createDrizzleFamilyDatabase(db),
    consentDatabase: createDrizzleConsentDatabase(db),
  };
}
