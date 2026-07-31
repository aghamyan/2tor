import { ulid } from "ulid";
import type { MarketingLead, MarketingLeadDatabase } from "./models";
import { createMarketingLeadSchema, type CreateMarketingLeadInput } from "./schemas";

const RETENTION_DAYS = 90;

/** Creates a minimal lead with an explicit 90-day deletion deadline. */
export async function createMarketingLead(
  database: MarketingLeadDatabase,
  input: CreateMarketingLeadInput | unknown,
  now = new Date(),
): Promise<MarketingLead> {
  const values = createMarketingLeadSchema.parse(input);
  const lead: MarketingLead = {
    id: ulid(),
    kind: values.kind,
    parentName: values.parentName,
    email: values.email.toLocaleLowerCase(),
    phone: values.phone,
    learnerAgeBand: values.learnerAgeBand,
    interest: values.interest,
    message: values.message,
    locale: values.locale,
    privacyConsentAt: now,
    retentionUntil: new Date(now.getTime() + RETENTION_DAYS * 24 * 60 * 60 * 1_000),
    createdAt: now,
  };
  await database.saveLead(lead);
  return lead;
}

export { RETENTION_DAYS };
