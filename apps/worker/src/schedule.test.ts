import path from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { closeConnection, closeQueues, getConnection, getQueue } from "./queue";
import { discoverJobs } from "./registry";
import { registerSchedules } from "./schedule";

let redisAvailable = true;
try {
  process.loadEnvFile(path.join(import.meta.dirname, "..", "..", "..", ".env"));
} catch {
  // No root .env file; rely on whatever the environment already provides.
}
try {
  await Promise.race([
    getConnection().ping(),
    new Promise((_resolve, reject) =>
      setTimeout(() => reject(new Error("redis ping timeout")), 2000),
    ),
  ]);
} catch {
  redisAvailable = false;
}

describe.skipIf(!redisAvailable)(
  "registerSchedules against a real Redis (docker compose's redis service)",
  () => {
    const fixturesJobsRoot = path.join(import.meta.dirname, "__fixtures__", "jobs");

    afterAll(async () => {
      await getQueue("fixtures-scheduled").obliterate({ force: true });
      await closeQueues();
      await closeConnection();
    });

    it("registers a job with options.repeat as a BullMQ repeatable job", async () => {
      const discovered = await discoverJobs({ root: fixturesJobsRoot });
      const scheduled = discovered.filter((job) => job.definition.name === "fixtures.scheduled");
      expect(scheduled).toHaveLength(1);

      await registerSchedules(scheduled);

      const repeatable = await getQueue("fixtures-scheduled").getRepeatableJobs();
      expect(repeatable).toHaveLength(1);
      expect(repeatable[0]).toMatchObject({ name: "fixtures.scheduled", pattern: "0 3 * * *" });
    });

    it("is safe to call again on worker restart: re-registering doesn't create a duplicate schedule", async () => {
      const discovered = await discoverJobs({ root: fixturesJobsRoot });
      const scheduled = discovered.filter((job) => job.definition.name === "fixtures.scheduled");

      await registerSchedules(scheduled);
      await registerSchedules(scheduled);

      const repeatable = await getQueue("fixtures-scheduled").getRepeatableJobs();
      expect(repeatable).toHaveLength(1);
    });
  },
);
