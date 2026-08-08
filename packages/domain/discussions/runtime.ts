import { getSession } from "@app/auth";
import { createDb, type Database } from "@app/db";
import { eq } from "drizzle-orm";
import Redis from "ioredis";
import { createDrizzleDiscussionDatabase } from "./drizzle-database";
import { DiscussionError } from "./errors";
import type { DiscussionActor, DiscussionDatabase, DiscussionRole } from "./models";
import type { DiscussionAuditPort } from "./moderation";
import { createS3DiscussionStorage } from "./s3-storage";
import type { DiscussionStorage } from "./storage";
import type { DiscussionViewDedup } from "./services";

const VIEW_DEDUP_TTL_SECONDS = 30 * 60;

function createRedisViewDedup(client: Redis): DiscussionViewDedup {
  return {
    async claimView(questionId, viewerKey) {
      const key = `discussions:view:${questionId}:${viewerKey}`;
      const claimed = await client.set(key, "1", "EX", VIEW_DEDUP_TTL_SECONDS, "NX");
      return claimed === "OK";
    },
  };
}

let databaseSingleton: Database | undefined;
let redisSingleton: Redis | undefined;

function database(): Database {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required for MathOverflow operations.");
  databaseSingleton ??= createDb(databaseUrl);
  return databaseSingleton;
}

function redis(): Redis {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) throw new Error("REDIS_URL is required for MathOverflow authentication.");
  redisSingleton ??= new Redis(redisUrl, { maxRetriesPerRequest: 1 });
  return redisSingleton;
}

/**
 * `@app/auth`'s `SessionRecord`/`Actor` carry `{userId, roles, mfaVerifiedAt}` — no
 * `studentProfileId`. `DiscussionActor.studentProfileId` (required by every student-authored
 * action's "is this actually you" check) is resolved here, once per request, via a direct lookup —
 * the one piece of session enrichment this module owns rather than asking `@app/auth` to carry it.
 */
async function resolveActor(
  db: Database,
  userId: string,
  roles: readonly DiscussionRole[],
): Promise<DiscussionActor> {
  if (!roles.includes("student")) return { userId, roles };
  const { studentProfiles } = await import("@app/db");
  const [row] = await db
    .select({ id: studentProfiles.id })
    .from(studentProfiles)
    .where(eq(studentProfiles.userId, userId))
    .limit(1);
  return { userId, roles, studentProfileId: row?.id };
}

async function auditPort(): Promise<DiscussionAuditPort> {
  const { createDrizzleAuditStore, recordAudit } = await import("@app/audit");
  const store = createDrizzleAuditStore(database());
  return {
    async recordAudit(input) {
      await recordAudit(store, input);
    },
  };
}

export interface DiscussionRequestContext {
  actor: DiscussionActor;
  database: DiscussionDatabase;
  storage: DiscussionStorage;
  audit: DiscussionAuditPort;
  viewDedup: DiscussionViewDedup;
}

export async function discussionRequestContext(
  sessionId: string | null | undefined,
): Promise<DiscussionRequestContext> {
  if (!sessionId) throw new DiscussionError("UNAUTHENTICATED", "A session is required.", 401);
  const session = await getSession(redis(), sessionId);
  if (!session) throw new DiscussionError("UNAUTHENTICATED", "The session is invalid.", 401);
  const db = database();
  const actor = await resolveActor(db, session.userId, session.roles as DiscussionRole[]);
  return {
    actor,
    database: createDrizzleDiscussionDatabase(db),
    storage: createS3DiscussionStorage(),
    audit: await auditPort(),
    viewDedup: createRedisViewDedup(redis()),
  };
}
