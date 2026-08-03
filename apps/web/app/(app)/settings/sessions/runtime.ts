import { recordAudit, createDrizzleAuditStore } from "@app/audit";
import { createDb, type Database } from "@app/db";

import { webRedis } from "../../../../lib/current-session";
import type { RevokeAllDevicesAuditPort, RevokeAllDevicesDeps } from "./logic";

let databaseSingleton: Database | undefined;

function database(): Database {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required to audit a logout-all-devices action.");
  databaseSingleton ??= createDb(url);
  return databaseSingleton;
}

/** Same composition-root pattern as `../../../(auth)/logout/runtime.ts` — see its file comment. */
function createAuditPort(): RevokeAllDevicesAuditPort {
  return {
    async recordLogoutAllDevices({ userId, ipAddress }) {
      const store = createDrizzleAuditStore(database());
      await recordAudit(store, {
        actorUserId: userId,
        action: "auth.logout_all_devices",
        resourceType: "user",
        resourceId: userId,
        reason: null,
        ipAddress,
      });
    },
  };
}

export function sessionsDeps(): RevokeAllDevicesDeps {
  return { redis: webRedis(), audit: createAuditPort() };
}
