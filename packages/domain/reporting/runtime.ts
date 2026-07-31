import { getSession, type Actor } from "@app/auth";
import { createDb, type Database } from "@app/db";
import Redis from "ioredis";
import { createDrizzleReportingRepository } from "./drizzle-repository";
import { ReportingError } from "./errors";

let databaseSingleton: Database | undefined;
let redisSingleton: Redis | undefined;

function database(): Database {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required for reporting operations.");
  databaseSingleton ??= createDb(url);
  return databaseSingleton;
}

function redis(): Redis {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL is required for reporting authentication.");
  redisSingleton ??= new Redis(url, { maxRetriesPerRequest: 1 });
  return redisSingleton;
}

export async function reportingRequestContext(sessionId: string | null | undefined): Promise<{
  actor: Actor;
  repository: ReturnType<typeof createDrizzleReportingRepository>;
}> {
  if (!sessionId) throw new ReportingError("UNAUTHENTICATED", "A session is required.", 401);
  const session = await getSession(redis(), sessionId);
  if (!session) throw new ReportingError("UNAUTHENTICATED", "The session is invalid.", 401);
  return {
    actor: {
      userId: session.userId,
      roles: session.roles,
      mfaVerifiedAt: session.mfaVerifiedAt ? new Date(session.mfaVerifiedAt) : null,
    },
    repository: createDrizzleReportingRepository(database()),
  };
}
