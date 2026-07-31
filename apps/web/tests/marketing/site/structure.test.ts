import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Vitest here has no JSX transform for `.tsx` (see tests/marketing/home/structure.test.ts's
// file-level comment for why) — these assertions read source as text, matching this repo's
// established pattern for structural checks it can't express via rendering.

const siteComponentsDirectory = path.join(import.meta.dirname, "../../../components/marketing/site");
const marketingSiteFile = path.join(
  import.meta.dirname,
  "../../../components/marketing/marketing-site.tsx",
);
const layoutFile = path.join(import.meta.dirname, "../../../app/(marketing)/layout.tsx");

async function readSiteSourceFiles(): Promise<Map<string, string>> {
  const entries = await readdir(siteComponentsDirectory);
  const files = new Map<string, string>();
  for (const entry of entries) {
    if (!entry.endsWith(".tsx") && !entry.endsWith(".ts")) continue;
    files.set(entry, await readFile(path.join(siteComponentsDirectory, entry), "utf8"));
  }
  return files;
}

describe("marketing site chrome structure", () => {
  it("renders exactly one <header> and one <footer>, both from apps/web/components/marketing/site", async () => {
    const files = await readSiteSourceFiles();
    let headerCount = 0;
    let footerCount = 0;
    for (const contents of files.values()) {
      headerCount += (contents.match(/<header[\s>]/g) ?? []).length;
      footerCount += (contents.match(/<footer[\s>]/g) ?? []).length;
    }
    expect(headerCount, "expected exactly one <header> across site/**").toBe(1);
    expect(footerCount, "expected exactly one <footer> across site/**").toBe(1);
  });

  it("never reintroduces MarketingChrome's own header/nav/footer", async () => {
    // Regression guard for the chrome-duplication bug this task fixed: MarketingChrome used to
    // render its own header/nav/footer, which — once (marketing)/layout.tsx added SiteHeader and
    // Footer around every page — would have doubled both landmarks on every marketing page.
    const contents = await readFile(marketingSiteFile, "utf8");
    expect(contents).not.toMatch(/<header[\s>]/);
    expect(contents).not.toMatch(/<footer[\s>]/);
    expect(contents).not.toMatch(/<nav[\s>]/);
  });

  it("wraps every (marketing) page with the shared header and footer", async () => {
    const contents = await readFile(layoutFile, "utf8");
    expect(contents).toMatch(/<SiteHeader/);
    expect(contents).toMatch(/<Footer/);
  });

  it("keeps AccountMenu's non-menuitem children out of the accessible menu tree", async () => {
    // aria-required-children (WCAG 1.3.1): role="menu" only permits menuitem/group/separator
    // descendants. AccountMenu's role label and the logout <form> wrapper aren't menu items, so
    // they must opt out via role="presentation"/"separator" rather than being bare children.
    const contents = await readFile(path.join(siteComponentsDirectory, "account-menu.tsx"), "utf8");
    expect(contents).toMatch(/role="presentation"/);
    expect(contents).toMatch(/role="separator"/);
    expect(contents).toMatch(/<form role="presentation"/);
  });

  it("does not override the compact language switcher's accessible name with a mismatched label", async () => {
    // WCAG 2.5.3 Label in Name: an aria-label that doesn't contain the visible text (e.g.
    // aria-label="Armenian" over visible "HY") fails it, and this component renders on every
    // page tests/a11y/wcag-22-aa.a11y.ts audits. The fix is to not override the accessible name
    // at all in compact mode — guard against a future aria-label being added back in.
    const contents = await readFile(
      path.join(siteComponentsDirectory, "language-switcher.tsx"),
      "utf8",
    );
    expect(contents).not.toMatch(/aria-label=\{.*candidate/);
  });

  it("keeps the defensive Tailwind-drift safety net on the mobile drawer", async () => {
    // Regression guard, not a "this is required" assertion: during this task, a long-running
    // `next dev` (Turbopack) session stopped compiling `.inset-x-0`/`.bottom-0`, leaving
    // DrawerContent at its static-flow document position instead of the viewport (confirmed via
    // Chrome DevTools Protocol's matched-styles inspection). A clean `next build` + `next start`
    // did NOT reproduce it, so this looks like transient dev-server drift, not a permanent
    // content-scan gap — but re-declaring the classes here costs nothing and directly guards the
    // one failure mode actually observed, so keep it rather than "clean up" the duplication.
    const contents = await readFile(path.join(siteComponentsDirectory, "mobile-nav.tsx"), "utf8");
    expect(contents).toMatch(/fixed inset-x-0 bottom-0 z-50/);
    // `DrawerOverlay`'s own `.inset-0` has no className prop to patch from here, so its guard is
    // a plain-text mention of "inset-0" inside this file's comment (Tailwind's scanner matches
    // literal class-like text anywhere in a scanned file, not only JSX attributes) — a loose
    // substring match, not a real class on an element, since that's genuinely where it lives.
    expect(contents).toMatch(/inset-0/);
  });

  it("does not hardcode a hex color in the site chrome stylesheet", async () => {
    const css = await readFile(path.join(siteComponentsDirectory, "site.module.css"), "utf8");
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(css).toContain("hsl(var(--site-");
  });

  it("honors prefers-reduced-motion in its own stylesheet", async () => {
    const css = await readFile(path.join(siteComponentsDirectory, "site.module.css"), "utf8");
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
  });
});
