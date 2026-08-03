import { describe, expect, it } from "vitest";

import { DASHBOARD_PANELS, panelsForDashboard } from "../../app/(app)/(dashboards)/_lib/catalog";

describe("dashboard composition catalog", () => {
  it("gives every dashboard stable, unique panel identifiers", () => {
    for (const panels of Object.values(DASHBOARD_PANELS)) {
      const ids = panels.map((panel) => panel.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(panels.every((panel) => panel.href.startsWith("/"))).toBe(true);
    }
  });

  it("keeps finance entirely outside academic and communication modules", () => {
    expect(new Set(panelsForDashboard("finance").map((panel) => panel.module))).toEqual(
      new Set(["payments", "payouts"]),
    );
  });

  it("gives parents a route to unread tutor messages", () => {
    expect(panelsForDashboard("parent").map((panel) => panel.module)).toContain("communication");
  });

  it("uses a simple younger composition and a detailed older composition", () => {
    const younger = panelsForDashboard("student-younger");
    const older = panelsForDashboard("student-older");
    expect(younger.length).toBeLessThan(older.length);
    expect(younger.map((panel) => panel.module)).toContain("gamification");
    expect(older.map((panel) => panel.module)).toEqual(
      expect.arrayContaining(["assessments", "projects", "discussions"]),
    );
  });

  it("covers every authenticated domain module across the role compositions", () => {
    const consumed = new Set(
      Object.values(DASHBOARD_PANELS)
        .flat()
        .map((panel) => panel.module),
    );
    expect(consumed).toEqual(
      new Set([
        "academics",
        "administration",
        "assessments",
        "assignments",
        "communication",
        "consent",
        "content",
        "discussions",
        "families",
        "gamification",
        "matching",
        "payments",
        "payouts",
        "projects",
        "reporting",
        "scheduling",
        "support",
        "tutors",
      ]),
    );
  });
});
