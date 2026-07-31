import { glob } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import type { JobDefinition, JobSchema } from "./job";

const DEFAULT_PATTERN = "**/*.job.ts";

/** `apps/worker/src/jobs` — every domain module drops its `*.job.ts` files somewhere under here. */
export function defaultJobsRoot(): string {
  return path.join(path.dirname(fileURLToPath(import.meta.url)), "jobs");
}

export interface DiscoverJobsOptions {
  /** Directory the glob pattern is resolved against. Defaults to {@link defaultJobsRoot}; tests override it. */
  root?: string;
  /** Glob pattern, relative to `root`. Defaults to `"**\/*.job.ts"`. */
  pattern?: string;
}

export interface DiscoveredJob {
  definition: JobDefinition;
  /** Absolute path of the `*.job.ts` file this definition was exported from. */
  filePath: string;
  /** `"default"`, or the named export key, for error messages and debugging. */
  exportName: string;
}

function isJobSchema(value: unknown): value is JobSchema<unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { parse?: unknown }).parse === "function" &&
    typeof (value as { safeParse?: unknown }).safeParse === "function"
  );
}

function isJobDefinition(value: unknown): value is JobDefinition {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<JobDefinition>;
  return (
    typeof candidate.name === "string" &&
    candidate.name.length > 0 &&
    typeof candidate.queue === "string" &&
    candidate.queue.length > 0 &&
    typeof candidate.handler === "function" &&
    isJobSchema(candidate.schema)
  );
}

/**
 * Globs `root` for `*.job.ts` files and dynamically imports each one. A file may export its job
 * definition as `default` or as one or more named exports (useful when one module file registers
 * several related jobs). Throws if a file matches the pattern but exports nothing job-shaped, or
 * if two definitions across any files share a `name` — job names are the BullMQ job name and the
 * dead-letter/idempotency key namespace, so they must be unique registry-wide.
 */
export async function discoverJobs(options: DiscoverJobsOptions = {}): Promise<DiscoveredJob[]> {
  const root = options.root ?? defaultJobsRoot();
  const pattern = options.pattern ?? DEFAULT_PATTERN;

  const discovered: DiscoveredJob[] = [];
  const fileByJobName = new Map<string, string>();

  for await (const relativePath of glob(pattern, { cwd: root })) {
    const absolutePath = path.join(root, relativePath);
    const moduleExports: Record<string, unknown> = await import(pathToFileURL(absolutePath).href);

    let matchedAnyExport = false;

    for (const [exportName, exportedValue] of Object.entries(moduleExports)) {
      if (!isJobDefinition(exportedValue)) {
        continue;
      }
      matchedAnyExport = true;

      const existingFilePath = fileByJobName.get(exportedValue.name);
      if (existingFilePath !== undefined) {
        throw new Error(
          `Duplicate job name "${exportedValue.name}" exported from both ${existingFilePath} and ` +
            `${absolutePath}. Job names must be unique across the registry.`,
        );
      }
      fileByJobName.set(exportedValue.name, absolutePath);

      discovered.push({ definition: exportedValue, filePath: absolutePath, exportName });
    }

    if (!matchedAnyExport) {
      throw new Error(
        `${absolutePath} matches "${pattern}" but exports no valid job definition ` +
          `(expected a default or named export with { name, queue, schema, handler }).`,
      );
    }
  }

  return discovered;
}
