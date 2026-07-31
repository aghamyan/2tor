import { getSession, type Actor } from "@app/auth";
import { createDb, type Database } from "@app/db";
import Redis from "ioredis";
import { createDrizzleAssessmentDatabase } from "./drizzle-database";
import { AssessmentError } from "./errors";

let databaseSingleton: Database | undefined;
let redisSingleton: Redis | undefined;

function database() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required for assessment operations.");
  databaseSingleton ??= createDb(url);
  return databaseSingleton;
}

function redis() {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL is required for assessment authentication.");
  redisSingleton ??= new Redis(url, { maxRetriesPerRequest: 1 });
  return redisSingleton;
}

export async function assessmentRequestContext(
  sessionId: string | null | undefined,
): Promise<{ actor: Actor; database: ReturnType<typeof createDrizzleAssessmentDatabase> }> {
  if (!sessionId) throw new AssessmentError("UNAUTHENTICATED", "A session is required.", 401);
  const session = await getSession(redis(), sessionId);
  if (!session) throw new AssessmentError("UNAUTHENTICATED", "The session is invalid.", 401);
  const assessmentsDatabase = createDrizzleAssessmentDatabase(database());
  return {
    actor: {
      userId: session.userId,
      roles: session.roles,
      studentProfileId: session.roles.includes("student")
        ? ((await assessmentsDatabase.findStudentProfileIdByUserId(session.userId)) ?? undefined)
        : undefined,
      mfaVerifiedAt: session.mfaVerifiedAt ? new Date(session.mfaVerifiedAt) : null,
    },
    database: assessmentsDatabase,
  };
}
