import { getSession, type Actor } from "@app/auth";
import { createDb, type Database } from "@app/db";
import Redis from "ioredis";
import { ContentError } from "./errors";
import { createDrizzleContentDatabase } from "./drizzle-database";
import type { GuardianStudentContext } from "./models";
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
  actor: Actor & {
    studentProfileId?: string;
    gradeLevel?: string | null;
    guardianStudents?: GuardianStudentContext[];
  };
  database: ReturnType<typeof createDrizzleContentDatabase>;
}> {
  if (!sessionId) throw new ContentError("UNAUTHENTICATED", "A session is required.", 401);
  const session = await getSession(redis(), sessionId);
  if (!session) throw new ContentError("UNAUTHENTICATED", "The session is invalid.", 401);
  const content = createDrizzleContentDatabase(database());
  const isStudent = session.roles.includes("student");
  const isParent = session.roles.includes("parent");
  const studentProfileId = isStudent
    ? ((await content.findStudentProfileIdByUserId(session.userId)) ?? undefined)
    : undefined;
  const [gradeLevel, guardianStudents] = await Promise.all([
    studentProfileId ? content.getStudentGradeLevel(studentProfileId) : Promise.resolve(undefined),
    isParent ? content.findGuardianStudentContexts(session.userId) : Promise.resolve(undefined),
  ]);
  return {
    actor: { userId: session.userId, roles: session.roles, studentProfileId, gradeLevel, guardianStudents },
    database: content,
  };
}
