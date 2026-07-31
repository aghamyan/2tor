import { ROLES } from "@app/auth";
import { describe, expect, it } from "vitest";

import { discoverNavItems } from "../../lib/nav-registry";
import { filterNavByRole } from "../../lib/role-guard";

const productionModuleIds = [
  "academics.overview",
  "administration.overview",
  "assessments.overview",
  "assignments.overview",
  "communication.inbox",
  "consent.overview",
  "content.overview",
  "discussions.overview",
  "families.overview",
  "gamification.overview",
  "matching.queue",
  "payments.overview",
  "payouts.overview",
  "projects.overview",
  "reporting.overview",
  "scheduling.overview",
  "support.queue",
  "tutors.profile",
] as const;

describe("authenticated module nav aggregation", () => {
  it("discovers every authenticated domain module with unique routing metadata", async () => {
    const items = await discoverNavItems();
    const productionItems = items.filter((item) =>
      (productionModuleIds as readonly string[]).includes(item.id),
    );
    expect(productionItems.map((item) => item.id).sort()).toEqual([...productionModuleIds].sort());
    expect(new Set(productionItems.map((item) => item.id)).size).toBe(productionItems.length);
    expect(new Set(productionItems.map((item) => item.href)).size).toBe(productionItems.length);
    expect(productionItems.every((item) => item.label.includes(".nav."))).toBe(true);
  });

  it("makes every registered module visible to at least one permitted role", async () => {
    const items = await discoverNavItems();
    const visible = new Set(
      ROLES.flatMap((role) => filterNavByRole(items, [role]).map((item) => item.id)),
    );
    for (const id of productionModuleIds) expect(visible.has(id)).toBe(true);
  });
});
