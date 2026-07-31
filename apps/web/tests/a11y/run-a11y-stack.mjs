import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const webDirectory = path.resolve(currentDirectory, "../..");
const repositoryRoot = path.resolve(webDirectory, "../..");
const stackScript = path.join(webDirectory, "e2e/scripts/run-test-stack.mjs");

const child = spawn(process.execPath, [stackScript], {
  cwd: repositoryRoot,
  env: process.env,
  stdio: "inherit",
});

function stop(signal) {
  if (!child.killed) child.kill(signal);
}

process.on("SIGINT", () => stop("SIGINT"));
process.on("SIGTERM", () => stop("SIGTERM"));

child.once("exit", (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
