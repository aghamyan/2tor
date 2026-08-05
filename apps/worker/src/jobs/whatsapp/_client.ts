import { createDb, type Database } from "@app/db";
import {
  createWhatsAppProvider,
  type WhatsAppProvider,
  type WhatsAppProviderConfig,
} from "@app/whatsapp";

/**
 * Composition-root glue for this job directory only — mirrors
 * `apps/worker/src/jobs/scheduling/_notifications.ts`'s rationale: no shared composition root
 * exists anywhere in this repo yet, so every job directory that needs an external client wires
 * its own. `WHATSAPP_ACCESS_TOKEN`/`WHATSAPP_PHONE_NUMBER_ID` read directly from `process.env`
 * (not `@app/config`) for the same reason `queue.ts`'s `getRedisUrl()` does — `@app/config`'s
 * server env module isn't reachable from outside `@app/config` itself (see apps/worker/README.md).
 */

let databaseSingleton: Database | undefined;
let providerSingleton: WhatsAppProvider | undefined;

export function getWhatsAppDatabase(): Database {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required for WhatsApp jobs.");
  databaseSingleton ??= createDb(databaseUrl);
  return databaseSingleton;
}

function whatsappProviderConfigFromEnv(): WhatsAppProviderConfig {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  // Falls back to the logging "disabled" provider kind whenever OBA credentials aren't
  // configured yet — jobs still run and exercise the full candidate-scan/idempotency logic.
  if (!accessToken || !phoneNumberId) return { kind: "disabled" };
  return {
    kind: "meta_cloud_api",
    accessToken,
    phoneNumberId,
    apiVersion: process.env.WHATSAPP_API_VERSION,
  };
}

export function getWhatsAppProvider(): WhatsAppProvider {
  providerSingleton ??= createWhatsAppProvider(whatsappProviderConfigFromEnv());
  return providerSingleton;
}
