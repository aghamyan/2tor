import { getSession, type Actor } from "@app/auth";
import { createDb, type Database } from "@app/db";
import Redis from "ioredis";
import { GamificationError } from "./errors";
import { createDrizzleGamificationDatabase } from "./drizzle-database";

let databaseSingleton: Database | undefined;
let redisSingleton: Redis | undefined;

function database() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required for gamification operations.");
  databaseSingleton ??= createDb(url);
  return databaseSingleton;
}
function redis() {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL is required for gamification authentication.");
  redisSingleton ??= new Redis(url, { maxRetriesPerRequest: 1 });
  return redisSingleton;
}

export async function gamificationRequestContext(sessionId: string | null | undefined): Promise<{
  actor: Actor & { studentProfileId?: string };
  database: ReturnType<typeof createDrizzleGamificationDatabase>;
}> {
  if (!sessionId) throw new GamificationError("UNAUTHENTICATED", "A session is required.", 401);
  const session = await getSession(redis(), sessionId);
  if (!session) throw new GamificationError("UNAUTHENTICATED", "The session is invalid.", 401);
  const adapter = createDrizzleGamificationDatabase(database());
  const studentProfileId = await adapter.findStudentProfileIdByUserId(session.userId);
  return {
    actor: {
      userId: session.userId,
      roles: session.roles,
      mfaVerifiedAt: session.mfaVerifiedAt ? new Date(session.mfaVerifiedAt) : null,
      ...(studentProfileId ? { studentProfileId } : {}),
    },
    database: adapter,
  };
}
