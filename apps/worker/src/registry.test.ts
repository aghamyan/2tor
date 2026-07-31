import path from "node:path";

import { describe, expect, it } from "vitest";

import { defaultJobsRoot, discoverJobs } from "./registry";

const fixturesDir = path.join(import.meta.dirname, "__fixtures__");

describe("discoverJobs", () => {
  it("resolves its default root to apps/worker/src/jobs", () => {
    expect(defaultJobsRoot()).toBe(path.join(import.meta.dirname, "jobs"));
  });

  it("globs *.job.ts under root and dynamically imports each one — dropping a fixture registers it automatically", async () => {
    const discovered = await discoverJobs({ root: path.join(fixturesDir, "jobs") });

    const names = discovered.map((job) => job.definition.name).sort();
    expect(names).toEqual([
      "fixtures.failing",
      "fixtures.idempotent",
      "fixtures.scheduled",
      "fixtures.succeeds",
    ]);

    // Every discovered definition has the shape the worker relies on at runtime.
    for (const { definition, filePath } of discovered) {
      expect(definition.queue.length).toBeGreaterThan(0);
      expect(typeof definition.handler).toBe("function");
      expect(typeof definition.schema.parse).toBe("function");
      expect(typeof definition.schema.safeParse).toBe("function");
      expect(filePath.endsWith(".job.ts")).toBe(true);
    }
  });

  it("ignores non-*.job.ts files (schema-helper.ts) under the same root", async () => {
    const discovered = await discoverJobs({ root: path.join(fixturesDir, "jobs") });
    expect(discovered.some((job) => job.filePath.endsWith("schema-helper.ts"))).toBe(false);
  });

  it("throws when two job files export the same job name", async () => {
    await expect(discoverJobs({ root: path.join(fixturesDir, "duplicate-jobs") })).rejects.toThrow(
      /Duplicate job name "fixtures.duplicate"/,
    );
  });

  it("throws when a *.job.ts file exports nothing job-shaped", async () => {
    await expect(discoverJobs({ root: path.join(fixturesDir, "invalid-jobs") })).rejects.toThrow(
      /exports no valid job definition/,
    );
  });

  it("returns an empty array when root has no matching files", async () => {
    const discovered = await discoverJobs({ root: path.join(fixturesDir, "empty-jobs") });
    expect(discovered).toEqual([]);
  });
});
