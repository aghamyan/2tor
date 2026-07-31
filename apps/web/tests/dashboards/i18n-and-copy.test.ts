import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

type JsonObject = { [key: string]: string | JsonObject };

function flatten(value: JsonObject, prefix = ""): string[] {
  return Object.entries(value).flatMap(([key, child]) => {
    const next = prefix ? `${prefix}.${key}` : key;
    return typeof child === "string" ? [next] : flatten(child, next);
  });
}

const workspaceRoot = path.resolve(import.meta.dirname, "../../../..");

async function messages(locale: "en" | "hy"): Promise<JsonObject> {
  return JSON.parse(
    await readFile(
      path.join(workspaceRoot, `packages/i18n/messages/${locale}/dashboards.json`),
      "utf8",
    ),
  ) as JsonObject;
}

describe("dashboard messages and progress copy", () => {
  it("keeps English and Armenian dashboard keys in exact parity", async () => {
    const [english, armenian] = await Promise.all([messages("en"), messages("hy")]);
    expect(flatten(armenian).sort()).toEqual(flatten(english).sort());
  });

  it("uses progress-trend language and contains no future-grade claim", async () => {
    const english = JSON.stringify(await messages("en")).toLocaleLowerCase();
    expect(english).toContain("progress trend");
    expect(english).not.toMatch(/projected[- ]grade/);
    expect(english).not.toMatch(/predicted[- ]grade/);
  });

  it("streams live signals behind an immediate dashboard shell", async () => {
    const dashboardDirectory = path.join(
      workspaceRoot,
      "apps/web/app/(app)/(dashboards)/dashboard",
    );
    const [loading, parentPage, summaries] = await Promise.all([
      readFile(path.join(dashboardDirectory, "loading.tsx"), "utf8"),
      readFile(path.join(dashboardDirectory, "parent/page.tsx"), "utf8"),
      readFile(
        path.join(workspaceRoot, "apps/web/app/(app)/(dashboards)/_lib/summaries.ts"),
        "utf8",
      ),
    ]);
    expect(loading).toContain("DashboardSummaryFallback");
    expect(parentPage).toContain("<Suspense");
    expect(summaries).toContain("Promise.all");
  });
});
