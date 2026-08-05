import path from "node:path";
import { fileURLToPath } from "node:url";

import playwrightTest from "../../node_modules/@playwright/test/index.js";

const { defineConfig, devices } = playwrightTest as unknown as typeof import("playwright/test");

const configDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(configDirectory, "../../../..");
const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3100";
const databaseURL =
  process.env.DATABASE_URL_TEST ?? "postgres://postgres:postgres@127.0.0.1:5433/app_test";

process.env.DATABASE_URL = databaseURL;

export default defineConfig({
  testDir: configDirectory,
  // The E2E stack creates its disposable workspace below apps/web/e2e. A distinct suffix keeps
  // the repository's ordinary **/*.spec.ts E2E discovery from collecting this copied suite.
  testMatch: "**/*.a11y.ts",
  outputDir: path.join(configDirectory, "test-results"),
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [
        ["line"],
        [
          "html",
          {
            outputFolder: path.join(configDirectory, "playwright-report"),
            open: "never",
          },
        ],
      ]
    : [["list"]],
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    headless: true,
    locale: "en-US",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop-chromium",
      use: {
        ...devices["Desktop Chrome"],
        timezoneId: "America/Los_Angeles",
      },
    },
    {
      name: "mobile-chromium",
      use: {
        ...devices["Pixel 5"],
        timezoneId: "America/Los_Angeles",
      },
    },
  ],
  webServer: {
    command: `node ${JSON.stringify(path.join(configDirectory, "run-a11y-stack.mjs"))}`,
    cwd: repositoryRoot,
    url: `http://127.0.0.1:${process.env.E2E_HEALTH_PORT ?? "3199"}/ready`,
    timeout: 180_000,
    reuseExistingServer: false,
    gracefulShutdown: { signal: "SIGTERM", timeout: 15_000 },
    stdout: "pipe",
    stderr: "pipe",
    env: {
      E2E_BASE_URL: baseURL,
      E2E_HEALTH_PORT: process.env.E2E_HEALTH_PORT ?? "3199",
      E2E_WEB_PORT: new URL(baseURL).port || "3100",
      DATABASE_URL: databaseURL,
      REDIS_URL: process.env.E2E_REDIS_URL ?? "redis://127.0.0.1:6389",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
});
