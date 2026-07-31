import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { footerGroups, primaryNav } from "../../../components/marketing/site/nav-items";

type JsonObject = { [key: string]: unknown };

/**
 * `tests/marketing/i18n.test.ts` already proves en/hy have *matching* key sets. It would not
 * catch a typo'd `labelKey` in `nav-items.ts` (e.g. "site.nav.pricng") as long as the same typo
 * were absent from *both* locale files — parity alone can't tell a real key from a consistently
 * wrong one. This resolves every key this task's components actually reference against the real
 * message tree, in both locales, so a typo fails loudly instead of silently rendering nothing.
 */
async function messages(locale: "en" | "hy"): Promise<JsonObject> {
  const path = fileURLToPath(
    new URL(`../../../../../packages/i18n/messages/${locale}/marketing.json`, import.meta.url),
  );
  return JSON.parse(await readFile(path, "utf8")) as JsonObject;
}

function resolve(tree: JsonObject, dottedKey: string): unknown {
  return dottedKey
    .split(".")
    .reduce<unknown>((node, segment) => {
      if (typeof node !== "object" || node === null) return undefined;
      return (node as JsonObject)[segment];
    }, tree);
}

function referencedKeys(): string[] {
  const navKeys = primaryNav.flatMap((entry) =>
    entry.type === "link" ? [entry.labelKey] : [entry.labelKey, ...entry.items.map((i) => i.labelKey)],
  );
  const footerKeys = [
    ...footerGroups.map((group) => group.headingKey),
    ...footerGroups.flatMap((group) => group.links.map((link) => link.labelKey)),
  ];
  const staticKeys = [
    "site.nav.ariaLabel",
    "site.actions.login",
    "site.actions.consultation",
    "site.actions.dashboard",
    "site.account.menuLabel",
    "site.account.settings",
    "site.account.logOut",
    "site.mobileNav.openMenu",
    "site.mobileNav.closeMenu",
    "site.mobileNav.title",
    "site.languageSwitcher.label",
    "site.languageSwitcher.en",
    "site.languageSwitcher.hy",
    "site.footer.copyright",
  ];
  return [...new Set([...navKeys, ...footerKeys, ...staticKeys])];
}

describe("site chrome message keys", () => {
  it.each(referencedKeys())("marketing.%s resolves to a non-empty string in en and hy", async (key) => {
    const en = await messages("en");
    const hy = await messages("hy");
    const enValue = resolve(en, `marketing.${key}`);
    const hyValue = resolve(hy, `marketing.${key}`);
    expect(typeof enValue, `marketing.${key} missing from en/marketing.json`).toBe("string");
    expect(typeof hyValue, `marketing.${key} missing from hy/marketing.json`).toBe("string");
    expect((enValue as string).length).toBeGreaterThan(0);
    expect((hyValue as string).length).toBeGreaterThan(0);
  });
});
