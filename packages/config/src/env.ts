import process from "node:process";

import { formatEnvIssues, publicEnvSchema, serverEnvSchema, type ServerEnv } from "./schema";

/**
 * Stops a server config import from being evaluated in a browser bundle.
 * Call this at the top of modules that consume server-only configuration.
 */
export function assertServerOnly(): void {
  if ("window" in globalThis) {
    throw new Error("Server configuration was imported into a client bundle.");
  }
}

function parseServerEnv(environment: NodeJS.ProcessEnv): ServerEnv {
  const serverResult = serverEnvSchema.safeParse(environment);
  const publicResult = publicEnvSchema.safeParse(environment);

  if (!serverResult.success || !publicResult.success) {
    const issues = [
      ...(serverResult.success ? [] : serverResult.error.issues),
      ...(publicResult.success ? [] : publicResult.error.issues),
    ];
    throw new Error(formatEnvIssues(issues));
  }

  return serverResult.data;
}

// This entrypoint is deliberately separate from ./index so public client code can
// import publicEnv without resolving or validating server secrets.
assertServerOnly();
export const serverEnv = parseServerEnv(process.env);
