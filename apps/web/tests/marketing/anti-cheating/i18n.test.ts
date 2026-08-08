import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

/** Mirrors tests/marketing/i18n.test.ts's approach: arrays are treated as opaque leaves, not
 *  recursed into, matching that established convention for this repo's message trees. */
type JsonObject = { [key: string]: unknown };
function leaves(value: JsonObject, prefix = ""): string[] {
  return Object.entries(value).flatMap(([key, child]) => {
    const dotted = prefix ? `${prefix}.${key}` : key;
    return typeof child === "object" && child !== null && !Array.isArray(child)
      ? leaves(child as JsonObject, dotted)
      : [dotted];
  });
}

async function messages(locale: "en" | "hy"): Promise<JsonObject> {
  const workspaceRoot = path.resolve(import.meta.dirname, "../../../../..");
  const contents = await readFile(
    path.join(workspaceRoot, `packages/i18n/messages/${locale}/anti-cheating.json`),
    "utf8",
  );
  return JSON.parse(contents) as JsonObject;
}

describe("anti-cheating i18n", () => {
  it("has exact English and Armenian message-key parity", async () => {
    expect(leaves(await messages("hy")).sort()).toEqual(leaves(await messages("en")).sort());
  });

  it("gives every capability item, monitoring option, and demo event the same array length in both locales", async () => {
    const en = (await messages("en")) as {
      antiCheating: { content: Record<string, Record<string, unknown[]>> };
    };
    const hy = (await messages("hy")) as {
      antiCheating: { content: Record<string, Record<string, unknown[]>> };
    };
    const c = en.antiCheating.content;
    const h = hy.antiCheating.content;
    expect((h.capabilities as unknown as { items: unknown[] }).items).toHaveLength(
      (c.capabilities as unknown as { items: unknown[] }).items.length,
    );
    expect((h.liveDemo as unknown as { events: unknown[] }).events).toHaveLength(
      (c.liveDemo as unknown as { events: unknown[] }).events.length,
    );
    expect((h.setup as unknown as { options: unknown[] }).options).toHaveLength(
      (c.setup as unknown as { options: unknown[] }).options.length,
    );
  });

  it("marks each capability item's status as real, camera, or future — never anything else", async () => {
    const en = (await messages("en")) as {
      antiCheating: { content: { capabilities: { items: { status: string }[] } } };
    };
    const allowed = new Set(["real", "camera", "future"]);
    for (const item of en.antiCheating.content.capabilities.items) {
      expect(allowed.has(item.status)).toBe(true);
    }
  });
});
