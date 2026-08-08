import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import type { MarketingLead, MarketingLeadDatabase } from "../../../../packages/domain/marketing/models";

// The route hard-codes marketingLeadStore(), which opens a real Postgres connection — mock it
// with an in-memory fake so this test doesn't depend on a database being reachable (there is
// none in the GitHub Actions CI environment).
class InMemoryMarketingLeadDatabase implements MarketingLeadDatabase {
  leads: MarketingLead[] = [];
  async saveLead(lead: MarketingLead): Promise<void> {
    this.leads.push(lead);
  }
}

vi.mock("../../app/api/leads/store", () => ({
  marketingLeadStore: () => new InMemoryMarketingLeadDatabase(),
}));

const { POST } = await import("../../app/api/leads/route");

function request(body: unknown, ip: string) {
  return new NextRequest("https://example.test/api/leads", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

describe("public lead endpoint", () => {
  it("validates minimal input", async () => {
    const response = await POST(
      request({ parentName: "A", email: "not-an-email", privacyConsent: false }, "198.51.100.10"),
    );
    expect(response.status).toBe(422);
  });
  it("rate-limits repeated requests from one address", async () => {
    const payload = { parentName: "Ada Parent", email: "ada@example.test", privacyConsent: true };
    for (let count = 0; count < 5; count += 1)
      expect((await POST(request(payload, "198.51.100.11"))).status).toBe(201);
    expect((await POST(request(payload, "198.51.100.11"))).status).toBe(429);
  });
});
