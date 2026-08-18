import { marketingLeads, type Database } from "@app/db";
import type { MarketingLead, MarketingLeadDatabase } from "./models";

function repository(database: Database): MarketingLeadDatabase {
  return {
    async saveLead(lead: MarketingLead) {
      await database.insert(marketingLeads).values({
        id: lead.id,
        kind: lead.kind,
        parentName: lead.parentName,
        email: lead.email,
        phone: lead.phone,
        learnerAgeBand: lead.learnerAgeBand,
        interest: lead.interest,
        message: lead.message,
        locale: lead.locale,
        privacyConsentAt: lead.privacyConsentAt,
        retentionUntil: lead.retentionUntil,
        createdAt: lead.createdAt,
      });
    },
  };
}

export function createDrizzleMarketingLeadDatabase(database: Database): MarketingLeadDatabase {
  return repository(database);
}
