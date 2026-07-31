import { getSession, type Actor } from "@app/auth";
import { createDb, type Database } from "@app/db";
import Redis from "ioredis";
import { AcademicError } from "./errors";
import { createDrizzleAcademicDatabase } from "./drizzle-database";

let databaseSingleton: Database | undefined;
let redisSingleton: Redis | undefined;
function database() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required for academic operations.");
  databaseSingleton ??= createDb(url);
  return databaseSingleton;
}
function redis() {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL is required for academic authentication.");
  redisSingleton ??= new Redis(url, { maxRetriesPerRequest: 1 });
  return redisSingleton;
}
export async function academicRequestContext(
  sessionId: string | null | undefined,
): Promise<{ actor: Actor; database: ReturnType<typeof createDrizzleAcademicDatabase> }> {
  if (!sessionId) throw new AcademicError("UNAUTHENTICATED", "A session is required.", 401);
  const session = await getSession(redis(), sessionId);
  if (!session) throw new AcademicError("UNAUTHENTICATED", "The session is invalid.", 401);
  return {
    actor: {
      userId: session.userId,
      roles: session.roles,
      mfaVerifiedAt: session.mfaVerifiedAt ? new Date(session.mfaVerifiedAt) : null,
    },
    database: createDrizzleAcademicDatabase(database()),
  };
}
