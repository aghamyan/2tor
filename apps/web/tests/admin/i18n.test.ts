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
    new URL(`../../../../packages/i18n/messages/${locale}/admin.json`, import.meta.url),
  );
  return JSON.parse(await readFile(path, "utf8")) as JsonObject;
}

describe("admin i18n", () => {
  it("has exact English and Armenian key parity", async () => {
    const [english, armenian] = await Promise.all([messages("en"), messages("hy")]);
    expect(leaves(armenian).sort()).toEqual(leaves(english).sort());
  });

  it("has no empty string values", async () => {
    const english = await messages("en");
    const blanks = leaves(english).filter((key) => {
      const value = key
        .split(".")
        .reduce<unknown>((acc, part) => (acc as JsonObject)?.[part], english);
      return typeof value === "string" && value.trim() === "";
    });
    expect(blanks).toEqual([]);
  });
});
