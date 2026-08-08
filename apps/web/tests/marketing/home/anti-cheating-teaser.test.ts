import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const homeDirectory = path.join(import.meta.dirname, "../../../components/marketing/home");

describe("homepage Anti-Cheating teaser", () => {
  it("is composed into HomePageContent, after the existing sections", async () => {
    const index = await readFile(path.join(homeDirectory, "index.tsx"), "utf8");
    expect(index).toMatch(/<AntiCheatingTeaser/);
    const heroIndex = index.indexOf("<Hero");
    const teaserIndex = index.indexOf("<AntiCheatingTeaser");
    expect(teaserIndex).toBeGreaterThan(heroIndex);
  });

  it("links to the dedicated /anti-cheating page for both CTAs", async () => {
    const teaser = await readFile(path.join(homeDirectory, "anti-cheating-teaser.tsx"), "utf8");
    expect(teaser).toContain("exploreHref");
    expect(teaser).toContain("howItWorksHref");
    const index = await readFile(path.join(homeDirectory, "index.tsx"), "utf8");
    expect(index).toMatch(/exploreHref=\{localHref\(locale, "\/anti-cheating"\)\}/);
    expect(index).toMatch(/howItWorksHref=\{localHref\(locale, "\/anti-cheating#how-it-works"\)\}/);
  });

  it("does not hardcode a hex color in its new stylesheet rules", async () => {
    const css = await readFile(path.join(homeDirectory, "compact-home.module.css"), "utf8");
    const section = css.slice(css.indexOf("/* Anti-Cheating teaser */"));
    expect(section.length).toBeGreaterThan(0);
    expect(section).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it("provides both English and Armenian copy for the teaser (HomeCopy is Record<Locale, ...>)", async () => {
    const index = await readFile(path.join(homeDirectory, "index.tsx"), "utf8");
    const enCount = (index.match(/antiCheating: \{/g) ?? []).length;
    expect(enCount).toBe(2);
  });
});
