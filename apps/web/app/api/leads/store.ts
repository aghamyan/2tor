import { createDb } from "@app/db";
import { createDrizzleMarketingLeadDatabase } from "../../../../../packages/domain/marketing/drizzle-database";
import type { MarketingLeadDatabase } from "../../../../../packages/domain/marketing/models";

/** Durable adapter for public leads — see packages/db/src/schema/marketing.ts. */
export function marketingLeadStore(): MarketingLeadDatabase {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required for marketing lead submissions.");
  return createDrizzleMarketingLeadDatabase(createDb(databaseUrl));
}
