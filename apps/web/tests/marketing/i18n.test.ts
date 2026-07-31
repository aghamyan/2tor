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
async function messages(locale: "en" | "hy") {
  return JSON.parse(
    await readFile(
      fileURLToPath(
        new URL(`../../../../packages/i18n/messages/${locale}/marketing.json`, import.meta.url),
      ),
      "utf8",
    ),
  ) as JsonObject;
}
describe("marketing i18n", () =>
  it("has exact English and Armenian message-key parity", async () =>
    expect(leaves(await messages("hy")).sort()).toEqual(leaves(await messages("en")).sort())));
