import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Vitest here has no JSX transform wired for `.tsx` (apps/web/tsconfig.json sets `"jsx":
 * "preserve"` for Next's SWC pipeline; Vite/esbuild honors that and no @vitejs/plugin-react is
 * registered in vitest.config.ts — confirmed empirically with a throwaway render test during
 * this task). Neither file is in this task's allowed scope to fix. These tests read source as
 * text instead, matching this repo's own established pattern for asserting on component/page
 * source — see tests/dashboards/i18n-and-copy.test.ts's "streams live signals..." test.
 */

const homeComponentsDirectory = path.join(
  import.meta.dirname,
  "../../../components/marketing/home",
);
const homePagePath = path.join(import.meta.dirname, "../../../app/(marketing)/home/page.tsx");

async function readSourceFiles(): Promise<Map<string, string>> {
  const entries = await readdir(homeComponentsDirectory);
  const files = new Map<string, string>();
  for (const entry of entries) {
    if (!entry.endsWith(".tsx") && !entry.endsWith(".ts") && !entry.endsWith(".css")) continue;
    files.set(entry, await readFile(path.join(homeComponentsDirectory, entry), "utf8"));
  }
  files.set("home/page.tsx", await readFile(homePagePath, "utf8"));
  return files;
}

describe("homepage structure", () => {
  it("renders exactly one <h1> across the whole component tree", async () => {
    const files = await readSourceFiles();
    let count = 0;
    for (const contents of files.values()) count += (contents.match(/<h1[\s>]/g) ?? []).length;
    expect(count).toBe(1);
  });

  it("keeps the single <h1> in the hero, the LCP-critical, JS-free section", async () => {
    const hero = await readFile(path.join(homeComponentsDirectory, "hero.tsx"), "utf8");
    expect(hero).toMatch(/<h1[\s>]/);
    expect(hero).not.toContain('"use client"');
  });

  it("never nests a second <main> inside the reused MarketingChrome", async () => {
    const files = await readSourceFiles();
    for (const [name, contents] of files) {
      expect(contents, `${name} should not render its own <main>`).not.toMatch(/<main[\s>]/);
    }
  });

  it("does not hardcode a hex color in the homepage stylesheet", async () => {
    const css = await readFile(path.join(homeComponentsDirectory, "home.module.css"), "utf8");
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(css).toContain("hsl(var(--home-");
  });

  it("honors prefers-reduced-motion in its own stylesheet (tokens.css's block isn't loaded)", async () => {
    const css = await readFile(path.join(homeComponentsDirectory, "home.module.css"), "utf8");
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
  });

  it("documents the consent-and-no-fabrication requirement next to testimonial content", async () => {
    const testimonials = await readFile(
      path.join(homeComponentsDirectory, "testimonials.tsx"),
      "utf8",
    );
    expect(testimonials.toLowerCase()).toContain("parental consent");
    expect(testimonials.toLowerCase()).toMatch(/never be fabricated|must not be fabricated/);
  });

  it("structurally gates testimonial rendering on verification, consent, and non-identifiability", async () => {
    const content = await readFile(path.join(homeComponentsDirectory, "content.ts"), "utf8");
    expect(content).toContain("relationshipVerified: true");
    expect(content).toContain("parentalConsent: true");
    expect(content).toContain("studentIdentifiable: false");
    expect(content).toContain("childName?: never");
    expect(content).toContain("childPhotoUrl?: never");
  });

  it("never claims a guaranteed grade or a 'no cheating' promise anywhere in the homepage tree", async () => {
    const files = await readSourceFiles();
    for (const [name, contents] of files) {
      const lower = contents.toLowerCase();
      expect(lower, `${name} must not promise a guaranteed grade`).not.toMatch(
        /guarantee[ds]?\s+(a\s+)?grade/,
      );
      expect(lower, `${name} must not make a "no cheating" claim`).not.toMatch(/no[\s-]cheating/);
    }
  });

  it("ships the heritage motif asset it references from CSS", async () => {
    const css = await readFile(path.join(homeComponentsDirectory, "home.module.css"), "utf8");
    expect(css).toContain("/marketing/heritage-motif.svg");
    const asset = await readFile(
      path.join(import.meta.dirname, "../../../public/marketing/heritage-motif.svg"),
      "utf8",
    );
    expect(asset).toContain("<svg");
  });
});
