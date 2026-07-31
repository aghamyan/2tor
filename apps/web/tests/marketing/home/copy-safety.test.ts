import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const workspaceRoot = path.resolve(import.meta.dirname, "../../../../..");

async function homeMessages(locale: "en" | "hy"): Promise<Record<string, unknown>> {
  const contents = await readFile(
    path.join(workspaceRoot, `packages/i18n/messages/${locale}/marketing.json`),
    "utf8",
  );
  const parsed = JSON.parse(contents) as { marketing: { home: Record<string, unknown> } };
  return parsed.marketing.home;
}

/** Mirrors tests/dashboards/i18n-and-copy.test.ts's progress-trend / no-projected-grade check. */
describe("homepage copy safety (en)", () => {
  it("uses progress-trend language for the parent dashboard, never a projected/predicted grade", async () => {
    const text = JSON.stringify(await homeMessages("en")).toLowerCase();
    expect(text).toContain("progress trend");
    expect(text).not.toMatch(/projected[- ]grade/);
    expect(text).not.toMatch(/predicted[- ]grade/);
  });

  it("never promises a guaranteed grade or makes a 'no cheating' claim", async () => {
    const text = JSON.stringify(await homeMessages("en")).toLowerCase();
    expect(text).not.toMatch(/guarantee[ds]?\s+(a\s+)?grade/);
    expect(text).not.toMatch(/no[\s-]cheating/);
  });

  it("uses the exact required hero headline and supporting line", async () => {
    const home = await homeMessages("en");
    const hero = (home as { hero: { title: string; description: string } }).hero;
    expect(hero.title).toBe(
      "Personalized online tutoring with verified Armenian educators — and progress parents can actually see.",
    );
    expect(hero.description).toBe(
      "Math, programming, and Armenian heritage lessons built around each learner's goals, with structured feedback, milestones, projects, and support between classes.",
    );
  });

  it("labels the testimonials section as sample content pending real, consented testimonials", async () => {
    const home = await homeMessages("en");
    const disclosure = (home as { testimonials: { disclosure: string } }).testimonials.disclosure;
    expect(disclosure.toLowerCase()).toMatch(/sample/);
    expect(disclosure.toLowerCase()).toContain("consent");
  });
});
