import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

type JsonObject = { [key: string]: unknown };

function leaves(value: JsonObject, prefix = ""): string[] {
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof child === "object" && child !== null && !Array.isArray(child)
      ? leaves(child as JsonObject, path)
      : [path];
  });
}

async function messages(locale: "en" | "hy"): Promise<JsonObject> {
  const path = fileURLToPath(
    new URL(`../../../../packages/i18n/messages/${locale}/app-shell.json`, import.meta.url),
  );
  return JSON.parse(await readFile(path, "utf8")) as JsonObject;
}

describe("app shell i18n", () => {
  it("has exact English and Armenian key parity", async () => {
    const [english, armenian] = await Promise.all([messages("en"), messages("hy")]);
    expect(leaves(armenian).sort()).toEqual(leaves(english).sort());
  });

  it("translates every role badge label used by the user menu", async () => {
    const english = (await messages("en")) as { appShell: { userMenu: { roles: JsonObject } } };
    const roleKeys = Object.keys(english.appShell.userMenu.roles).sort();
    expect(roleKeys).toEqual(
      ["administrator", "finance", "parent", "student", "super_administrator", "tutor"].sort(),
    );
  });

  it("does not paste an untranslated English string into the Armenian catalog", async () => {
    const [english, armenian] = await Promise.all([messages("en"), messages("hy")]);
    const englishLeafValues = new Set(
      Object.entries(flattenValues(english)).map(([, value]) => value),
    );
    const armenianEntries = Object.entries(flattenValues(armenian));
    for (const [key, value] of armenianEntries) {
      // ICU interpolation placeholders like "{count}" are language-neutral and legitimately
      // reappear in both catalogs; only flag a full string match.
      if (englishLeafValues.has(value)) {
        expect.fail(`hy/app-shell.json key "${key}" is identical to its English source: "${value}"`);
      }
    }
  });
});

function flattenValues(value: JsonObject, prefix = ""): Record<string, string> {
  return Object.entries(value).reduce<Record<string, string>>((acc, [key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof child === "object" && child !== null && !Array.isArray(child)) {
      Object.assign(acc, flattenValues(child as JsonObject, path));
    } else {
      acc[path] = String(child);
    }
    return acc;
  }, {});
}
