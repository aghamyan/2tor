import { getSession, type Actor } from "@app/auth";
import { createDb, type Database } from "@app/db";
import Redis from "ioredis";
import { createDrizzleSupportDatabase } from "./drizzle-database";
import { SupportError } from "./errors";
import type { SupportSafetyEscalationHook } from "./models";

let databaseSingleton: Database | undefined;
let redisSingleton: Redis | undefined;
function database(): Database {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required for support operations.");
  databaseSingleton ??= createDb(url);
  return databaseSingleton;
}
function redis(): Redis {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL is required for support authentication.");
  redisSingleton ??= new Redis(url, { maxRetriesPerRequest: 1 });
  return redisSingleton;
}
export async function supportRequestContext(
  sessionId: string | null | undefined,
): Promise<{ actor: Actor; database: ReturnType<typeof createDrizzleSupportDatabase> }> {
  if (!sessionId) throw new SupportError("UNAUTHENTICATED", "A session is required.", 401);
  const session = await getSession(redis(), sessionId);
  if (!session) throw new SupportError("UNAUTHENTICATED", "The session is invalid.", 401);
  return {
    actor: {
      userId: session.userId,
      roles: session.roles,
      mfaVerifiedAt: session.mfaVerifiedAt ? new Date(session.mfaVerifiedAt) : null,
    },
    database: createDrizzleSupportDatabase(database()),
  };
}

/** Optional production adapter for the on-call service. Source modules can inject their own hook. */
export function supportSafetyEscalationHookFromEnvironment():
  SupportSafetyEscalationHook | undefined {
  const endpoint = process.env.SUPPORT_SAFETY_ESCALATION_WEBHOOK_URL;
  if (!endpoint) return undefined;
  return {
    async escalate({ ticket, incident }) {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": incident.id },
        body: JSON.stringify({
          ticketId: ticket.id,
          incidentId: incident.id,
          category: ticket.category,
          source: ticket.source,
        }),
      });
      if (!response.ok)
        throw new Error(`Safety escalation webhook failed with ${response.status}.`);
    },
  };
}
