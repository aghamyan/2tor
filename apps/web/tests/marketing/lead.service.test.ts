import { describe, expect, it } from "vitest";
import { createMarketingLead } from "../../../../packages/domain/marketing/services";
import type {
  MarketingLead,
  MarketingLeadDatabase,
} from "../../../../packages/domain/marketing/models";

class MemoryLeads implements MarketingLeadDatabase {
  leads: MarketingLead[] = [];
  async saveLead(lead: MarketingLead) {
    this.leads.push(lead);
  }
}

describe("marketing lead service", () => {
  it("stores minimal consented data with a 90-day retention deadline", async () => {
    const database = new MemoryLeads();
    const now = new Date("2026-07-29T10:00:00.000Z");
    const lead = await createMarketingLead(
      database,
      { parentName: "Ada Parent", email: "ADA@EXAMPLE.TEST", privacyConsent: true },
      now,
    );
    expect(lead.email).toBe("ada@example.test");
    expect(lead.retentionUntil.toISOString()).toBe("2026-10-27T10:00:00.000Z");
    expect(database.leads).toHaveLength(1);
  });
  it("requires affirmative privacy consent", async () => {
    await expect(
      createMarketingLead(new MemoryLeads(), {
        parentName: "Ada",
        email: "ada@example.test",
        privacyConsent: false,
      }),
    ).rejects.toBeTruthy();
  });
});
