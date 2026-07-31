import { getSession, type Actor } from "@app/auth";
import { createDb, type Database } from "@app/db";
import Redis from "ioredis";
import { ContentError } from "./errors";
import { createDrizzleContentDatabase } from "./drizzle-database";
let databaseSingleton: Database | undefined;
let redisSingleton: Redis | undefined;
function database() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required for content operations.");
  databaseSingleton ??= createDb(url);
  return databaseSingleton;
}
function redis() {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL is required for content authentication.");
  redisSingleton ??= new Redis(url, { maxRetriesPerRequest: 1 });
  return redisSingleton;
}
export async function contentRequestContext(sessionId: string | null | undefined): Promise<{
  actor: Actor & { studentProfileId?: string };
  database: ReturnType<typeof createDrizzleContentDatabase>;
}> {
  if (!sessionId) throw new ContentError("UNAUTHENTICATED", "A session is required.", 401);
  const session = await getSession(redis(), sessionId);
  if (!session) throw new ContentError("UNAUTHENTICATED", "The session is invalid.", 401);
  const content = createDrizzleContentDatabase(database());
  return {
    actor: {
      userId: session.userId,
      roles: session.roles,
      studentProfileId: session.roles.includes("student")
        ? ((await content.findStudentProfileIdByUserId(session.userId)) ?? undefined)
        : undefined,
    },
    database: content,
  };
}
