import { recordAudit, createDrizzleAuditStore } from "@app/audit";
import { createDb, type Database } from "@app/db";

import { webRedis } from "../../../lib/current-session";
import type { LogoutAuditPort, LogoutDeps } from "./logic";

let databaseSingleton: Database | undefined;

function database(): Database {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required to audit a staff logout.");
  databaseSingleton ??= createDb(url);
  return databaseSingleton;
}

/**
 * Binds the real `@app/audit` package to `logic.ts`'s structural `LogoutAuditPort` — same
 * composition-root pattern `packages/domain/administration/runtime.ts` uses for the real
 * `@app/audit`, kept local here since `packages/domain` is out of this task's file scope.
 */
function createAuditPort(): LogoutAuditPort {
  return {
    async recordStaffLogout({ userId, sessionId, ipAddress }) {
      const store = createDrizzleAuditStore(database());
      await recordAudit(store, {
        actorUserId: userId,
        action: "auth.logout",
        resourceType: "session",
        resourceId: sessionId,
        reason: null,
        ipAddress,
      });
    },
  };
}

export function logoutDeps(): LogoutDeps {
  return { redis: webRedis(), audit: createAuditPort() };
}
