import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const componentsDirectory = path.join(
  import.meta.dirname,
  "../../../components/marketing/anti-cheating",
);

async function readSourceFiles(): Promise<Map<string, string>> {
  const entries = await readdir(componentsDirectory);
  const files = new Map<string, string>();
  for (const entry of entries) {
    if (!entry.endsWith(".tsx") && !entry.endsWith(".ts") && !entry.endsWith(".css")) continue;
    files.set(entry, await readFile(path.join(componentsDirectory, entry), "utf8"));
  }
  return files;
}

describe("anti-cheating module structure", () => {
  it("never calls getUserMedia or otherwise attempts camera/microphone access (project brief §23)", async () => {
    const files = await readSourceFiles();
    for (const [name, contents] of files) {
      expect(contents, `${name} must not request camera/microphone access`).not.toMatch(
        /getUserMedia|mediaDevices\.getDisplayMedia/,
      );
    }
  });

  it("keeps real-time signal capture limited to the documented browser-observable event set", async () => {
    const contents = await readFile(path.join(componentsDirectory, "real-monitoring.ts"), "utf8");
    for (const api of [
      "visibilitychange",
      "blur",
      "fullscreenchange",
      '"copy"',
      '"paste"',
    ]) {
      expect(contents).toContain(api);
    }
    // Only these APIs — nothing that reaches outside the tab (network, other windows, storage).
    expect(contents).not.toMatch(/fetch\(|XMLHttpRequest|BroadcastChannel|localStorage|indexedDB/);
  });

  it("does not hardcode a hex color in any anti-cheating stylesheet", async () => {
    const files = await readSourceFiles();
    for (const [name, contents] of files) {
      if (!name.endsWith(".css")) continue;
      expect(contents, `${name} should use hsl(var(--vz-*)) tokens, not a hex literal`).not.toMatch(
        /#[0-9a-fA-F]{3,8}\b/,
      );
    }
  });

  it("respects prefers-reduced-motion in every stylesheet that drives its own CSS animation", async () => {
    const visualCss = await readFile(
      path.join(componentsDirectory, "monitoring-visual.module.css"),
      "utf8",
    );
    expect(visualCss).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
  });

  it("gates the student-mode dialog with aria-modal and an Escape-to-exit handler", async () => {
    const contents = await readFile(
      path.join(componentsDirectory, "student-homework-mode.tsx"),
      "utf8",
    );
    expect(contents).toContain('aria-modal="true"');
    expect(contents).toContain('role="dialog"');
    expect(contents).toContain('"Escape"');
  });

  it("never labels a detected event as a verdict — only 'possible' / 'detected' framing in demo data", async () => {
    const contents = await readFile(path.join(componentsDirectory, "demo-data.ts"), "utf8");
    expect(contents.toLowerCase()).not.toMatch(/cheated|cheating confirmed/);
  });
});

describe("anti-cheating route wiring", () => {
  it("is registered as a public marketing slug", async () => {
    const seo = await readFile(
      path.join(import.meta.dirname, "../../../components/marketing/seo.ts"),
      "utf8",
    );
    expect(seo).toMatch(/"anti-cheating"/);
  });

  it("is reachable without a session (proxy.ts PUBLIC_PATHS)", async () => {
    const proxy = await readFile(path.join(import.meta.dirname, "../../../proxy.ts"), "utf8");
    expect(proxy).toMatch(/"\/anti-cheating"/);
  });

  it("has a pageKey and StandardPage branch in marketing-site.tsx", async () => {
    const site = await readFile(
      path.join(import.meta.dirname, "../../../components/marketing/marketing-site.tsx"),
      "utf8",
    );
    expect(site).toContain('"anti-cheating": "antiCheating"');
    expect(site).toContain('slug === "anti-cheating"');
  });
});
