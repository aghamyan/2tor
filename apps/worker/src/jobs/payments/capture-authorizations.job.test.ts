import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { JobContext, JobLogger } from "../../job";
import captureAuthorizationsJob from "./capture-authorizations.job";

const originalEnvironment = process.env.NODE_ENV;
const originalDatabaseUrl = process.env.DATABASE_URL;
const originalStripeSecretKey = process.env.STRIPE_SECRET_KEY;

function createContext() {
  const log: JobLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(() => log),
  };

  return {
    context: {
      jobId: "test-job",
      queue: "payments",
      name: captureAuthorizationsJob.name,
      attemptsMade: 1,
      log,
    } satisfies JobContext,
    log,
  };
}

describe("payments.capture-authorizations", () => {
  beforeEach(() => {
    process.env.DATABASE_URL = "postgres://unused-in-this-test";
    delete process.env.STRIPE_SECRET_KEY;
  });

  afterEach(() => {
    vi.restoreAllMocks();

    if (originalEnvironment === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalEnvironment;

    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;

    if (originalStripeSecretKey === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = originalStripeSecretKey;
  });

  it("skips safely outside production when Stripe is not configured", async () => {
    process.env.NODE_ENV = "development";
    const { context, log } = createContext();

    await expect(captureAuthorizationsJob.handler({}, context)).resolves.toBeUndefined();
    expect(log.warn).toHaveBeenCalledWith(
      { environment: "development" },
      "payment capture skipped because STRIPE_SECRET_KEY is not configured",
    );
  });

  it("still fails fast in production when Stripe is not configured", async () => {
    process.env.NODE_ENV = "production";
    const { context } = createContext();

    await expect(captureAuthorizationsJob.handler({}, context)).rejects.toThrow(
      "STRIPE_SECRET_KEY is required for payment capture.",
    );
  });
});
