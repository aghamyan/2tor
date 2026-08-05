import playwrightTest from "./apps/web/node_modules/@playwright/test/index.js";

const { defineConfig, devices } = playwrightTest;

const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3100";
const databaseURL =
  process.env.DATABASE_URL_TEST ?? "postgres://postgres:postgres@127.0.0.1:5433/app_test";

// The web server receives these values explicitly below. Setting them on the runner as well lets
// the retention-worker harness exercise the same isolated database from a Playwright test.
process.env.DATABASE_URL = databaseURL;

export default defineConfig({
  testDir: "./apps/web/e2e",
  testMatch: "**/*.spec.ts",
  outputDir: "./apps/web/e2e/test-results",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  // These are deliberately stateful cross-module journeys over one freshly seeded database.
  // Retrying only the failed test would reuse partial state and could hide the original failure.
  retries: 0,
  reporter: process.env.CI
    ? [["line"], ["html", { outputFolder: "apps/web/e2e/playwright-report", open: "never" }]]
    : [["list"]],
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    headless: true,
    locale: "en-US",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        timezoneId: "America/Los_Angeles",
      },
    },
  ],
  webServer: {
    command: "node apps/web/e2e/scripts/run-test-stack.mjs",
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
