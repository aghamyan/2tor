import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guards the project brief's central promise: this product detects and reports signals, it does
 * not accuse a child of cheating or claim certainty a browser can't have. See
 * `packages/domain/assessments/README.md`'s "Signals are not proof" for the platform-wide version
 * of the same contract this marketing copy has to keep.
 */
async function englishCopy(): Promise<string> {
  const workspaceRoot = path.resolve(import.meta.dirname, "../../../../..");
  const contents = await readFile(
    path.join(workspaceRoot, "packages/i18n/messages/en/anti-cheating.json"),
    "utf8",
  );
  return JSON.stringify(JSON.parse(contents)).toLowerCase();
}

describe("anti-cheating copy safety", () => {
  it("never claims total or guaranteed cheating prevention", async () => {
    const text = await englishCopy();
    expect(text).not.toMatch(/100%\s*(cheating\s*)?prevention/);
    expect(text).not.toMatch(/guarantee[ds]?\s+(that\s+)?(no|zero)\s*cheating/);
    expect(text).not.toMatch(/eliminate[s]?\s+cheating/);
    expect(text).not.toMatch(/prevents?\s+all\s+cheating/);
  });

  it("never accuses a child of cheating directly", async () => {
    const text = await englishCopy();
    expect(text).not.toMatch(/your child cheated/);
    expect(text).not.toMatch(/\bcaught cheating\b/);
    expect(text).not.toMatch(/\bis a cheater\b/);
  });

  it("uses hedged, review-oriented language for detected events", async () => {
    const text = await englishCopy();
    expect(text).toContain("possible");
    expect(text).toContain("review recommended");
  });

  it("carries an explicit not-proof disclaimer on the integrity score", async () => {
    const text = await englishCopy();
    expect(text).toMatch(/integrity score.*(indicator|not definitive proof)/);
  });

  it("never claims to see outside the browser tab without qualifying it as a future/planned capability", async () => {
    const parsed = JSON.parse(
      await readFile(
        path.join(
          path.resolve(import.meta.dirname, "../../../../.."),
          "packages/i18n/messages/en/anti-cheating.json",
        ),
        "utf8",
      ),
    ) as {
      antiCheating: {
        content: { capabilities: { items: { key: string; status: string }[] } };
      };
    };
    const items = parsed.antiCheating.content.capabilities.items;
    const external = items.find((item) => item.key === "external-resource");
    const ai = items.find((item) => item.key === "ai-resource");
    expect(external?.status).toBe("future");
    expect(ai?.status).toBe("future");
  });
});
