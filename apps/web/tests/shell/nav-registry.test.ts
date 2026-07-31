import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

import { discoverNavItems } from "../../lib/nav-registry";

const domainDirectory = fileURLToPath(new URL("../../../../packages/domain/", import.meta.url));
const fixtureDirectories: [string, string] = [
  path.join(domainDirectory, "foo"),
  path.join(domainDirectory, "bar"),
];

afterEach(async () => {
  // Runs even if an assertion above throws, so a failed run never leaves these locked
  // directories (packages/domain/*) behind.
  await Promise.all(fixtureDirectories.map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("discoverNavItems", () => {
  it("has no fixture registered by default", async () => {
    const items = await discoverNavItems();
    expect(items.find((item) => item.id === "foo.dashboard")).toBeUndefined();
  });

  it("picks up a module's nav.ts default export with no shell edits", async () => {
    const [fixtureModuleDirectory] = fixtureDirectories;
    await mkdir(fixtureModuleDirectory, { recursive: true });
    await writeFile(
      path.join(fixtureModuleDirectory, "nav.ts"),
      [
        "const item = {",
        '  id: "foo.dashboard",',
        '  label: "foo.nav.dashboard",',
        '  href: "/foo/dashboard",',
        "  roles: [],",
        "};",
        "export default item;",
        "",
      ].join("\n"),
      "utf8",
    );

    const items = await discoverNavItems();
    expect(items).toContainEqual({
      id: "foo.dashboard",
      label: "foo.nav.dashboard",
      href: "/foo/dashboard",
      roles: [],
    });
  });

  it("ignores a nav.ts that doesn't export a well-formed NavItem", async () => {
    const [, fixtureModuleDirectory] = fixtureDirectories;
    await mkdir(fixtureModuleDirectory, { recursive: true });
    await writeFile(
      path.join(fixtureModuleDirectory, "nav.ts"),
      "export default { nope: true };\n",
      "utf8",
    );

    const items = await discoverNavItems();
    expect(items.find((item) => item.id === "bar.dashboard")).toBeUndefined();
  });
});
