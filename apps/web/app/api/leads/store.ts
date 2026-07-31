import type {
  MarketingLead,
  MarketingLeadDatabase,
} from "../../../../../packages/domain/marketing/models";

/**
 * Adapter seam for public leads. There is no permitted database migration/table in this slice;
 * deployments should replace this process-local adapter with the approved durable lead store.
 * The record itself always carries `retentionUntil` for the 90-day deletion job.
 */
class InMemoryLeadStore implements MarketingLeadDatabase {
  readonly leads = new Map<string, MarketingLead>();
  async saveLead(lead: MarketingLead) {
    this.leads.set(lead.id, lead);
  }
}

const globalStore = globalThis as typeof globalThis & { __marketingLeadStore?: InMemoryLeadStore };
export const marketingLeadStore = (globalStore.__marketingLeadStore ??= new InMemoryLeadStore());
