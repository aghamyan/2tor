import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { footerGroups, primaryNav } from "../../../components/marketing/site/nav-items";

/**
 * `proxy.ts` gates every non-public path behind a session (see its `PUBLIC_PATHS` comment: "deny
 * by default"). It can't be imported directly here — it's Edge middleware that pulls in
 * `next/server` — so, matching this repo's own established pattern of reading source as text for
 * structural assertions (see `tests/marketing/i18n.test.ts`, `tests/marketing/home/structure.test.ts`),
 * this parses the `PUBLIC_PATHS` set literal straight out of the file. A nav or footer link whose
 * href isn't in that set would silently redirect a logged-out visitor to `/login` instead of the
 * page they clicked — exactly the trap `nav-items.ts`'s own file header warns about.
 */
async function readPublicPaths(): Promise<Set<string>> {
  const proxyPath = fileURLToPath(new URL("../../../proxy.ts", import.meta.url));
  const source = await readFile(proxyPath, "utf8");
  const match = source.match(/PUBLIC_PATHS = new Set<string>\(\[([\s\S]*?)\]\)/);
  const body = match?.[1];
  if (!body) throw new Error("Could not find PUBLIC_PATHS in proxy.ts — has it been renamed?");
  const paths = [...body.matchAll(/"([^"]+)"/g)].flatMap((m) => (m[1] ? [m[1]] : []));
  return new Set(paths);
}

function flattenNavHrefs(): string[] {
  return primaryNav.flatMap((entry) =>
    entry.type === "link" ? [entry.href] : entry.items.map((item) => item.href),
  );
}

function flattenFooterHrefs(): string[] {
  return footerGroups.flatMap((group) => group.links.map((link) => link.href));
}

describe("site nav/footer hrefs", () => {
  it("every primary nav href is reachable without a session", async () => {
    const publicPaths = await readPublicPaths();
    for (const href of flattenNavHrefs()) {
      expect(publicPaths.has(href), `${href} is missing from proxy.ts's PUBLIC_PATHS`).toBe(true);
    }
  });

  it("every footer link href is reachable without a session", async () => {
    const publicPaths = await readPublicPaths();
    for (const href of flattenFooterHrefs()) {
      expect(publicPaths.has(href), `${href} is missing from proxy.ts's PUBLIC_PATHS`).toBe(true);
    }
  });

  it("has no duplicate ids within primary nav or any footer group", () => {
    const navIds = primaryNav.map((entry) => entry.id);
    expect(new Set(navIds).size).toBe(navIds.length);

    for (const group of footerGroups) {
      const linkIds = group.links.map((link) => link.id);
      expect(new Set(linkIds).size, `duplicate link id in footer group "${group.id}"`).toBe(
        linkIds.length,
      );
    }
  });
});
