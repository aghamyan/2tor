import { randomUUID } from "node:crypto";
import path from "node:path";

import type { Worker } from "bullmq";
import { afterAll, describe, expect, it } from "vitest";

import failingJob from "./__fixtures__/jobs/failing.job";
import idempotentJob from "./__fixtures__/jobs/idempotent.job";
import succeedsJob from "./__fixtures__/jobs/succeeds.job";
import {
  closeConnection,
  closeQueues,
  createWorkerForQueue,
  enqueueJob,
  getConnection,
  getDeadLetterQueue,
  getQueue,
} from "./queue";
import { discoverJobs } from "./registry";

async function waitFor(
  check: () => Promise<boolean>,
  timeoutMs = 5000,
  intervalMs = 25,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error("waitFor: condition was not met within the timeout");
}

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
  "queue.ts against a real Redis (docker compose's redis service)",
  () => {
    const fixturesJobsRoot = path.join(import.meta.dirname, "__fixtures__", "jobs");
    const workers: Worker[] = [];

    afterAll(async () => {
      await Promise.all(workers.map((worker) => worker.close()));

      const queueNames = ["fixtures-succeeds", "fixtures-failing", "fixtures-idempotent"];
      await Promise.all(
        queueNames.flatMap((name) => [
          getQueue(name).obliterate({ force: true }),
          getDeadLetterQueue(name).obliterate({ force: true }),
        ]),
      );

      await closeQueues();
      await closeConnection();
    });

    it("discovers fixtures.succeeds via the glob registry and actually executes it (discovery + execution)", async () => {
      const discovered = await discoverJobs({ root: fixturesJobsRoot });
      const definitions = discovered.filter((job) => job.definition.queue === "fixtures-succeeds");
      expect(definitions).toHaveLength(1);

      const worker = createWorkerForQueue("fixtures-succeeds", definitions);
      workers.push(worker);

      const counterKey = `test:counter:${randomUUID()}`;
      const job = await enqueueJob(succeedsJob, { counterKey });

      await waitFor(async () => (await job.getState()) === "completed");

      const count = await getConnection().get(counterKey);
      expect(count).toBe("1");
    });

    it("retries a failing job with backoff, then moves it to the dead-letter queue", async () => {
      const discovered = await discoverJobs({ root: fixturesJobsRoot });
      const definitions = discovered.filter((job) => job.definition.queue === "fixtures-failing");

      const worker = createWorkerForQueue("fixtures-failing", definitions);
      workers.push(worker);

      const job = await enqueueJob(failingJob, { marker: randomUUID() });

      const dlq = getDeadLetterQueue("fixtures-failing");
      await waitFor(async () => {
        const counts = await dlq.getJobCounts("waiting");
        return (counts.waiting ?? 0) >= 1;
      });

      const dlqJobs = await dlq.getJobs(["waiting"]);
      expect(dlqJobs).toHaveLength(1);

      const [dlqJob] = dlqJobs;
      if (!dlqJob) {
        throw new Error("expected exactly one job on the dead-letter queue");
      }
      const dlqPayload = dlqJob.data as {
        originalJobId: string;
        attemptsMade: number;
        failedReason: string;
      };
      // 3 attempts (fixtures.failing's configured max) proves it actually retried with backoff
      // before landing in the DLQ, rather than failing once and skipping straight there.
      expect(dlqPayload.originalJobId).toBe(job.id);
      expect(dlqPayload.attemptsMade).toBe(3);
      expect(dlqPayload.failedReason).toContain("fixtures.failing always fails");

      expect(await job.getState()).toBe("failed");
    });

    it("runs an idempotent job's handler once for a repeated idempotency key", async () => {
      const discovered = await discoverJobs({ root: fixturesJobsRoot });
      const definitions = discovered.filter(
        (job) => job.definition.queue === "fixtures-idempotent",
      );

      const worker = createWorkerForQueue("fixtures-idempotent", definitions);
      workers.push(worker);

      const idempotencyKey = randomUUID();
      const counterKey = `test:counter:${randomUUID()}`;

      const jobA = await enqueueJob(idempotentJob, { key: idempotencyKey, counterKey });
      await waitFor(async () => (await jobA.getState()) === "completed");

      const jobB = await enqueueJob(idempotentJob, { key: idempotencyKey, counterKey });
      await waitFor(async () => (await jobB.getState()) === "completed");

      expect(jobA.id).not.toBe(jobB.id); // two distinct BullMQ jobs, not producer-side jobId dedupe
      expect(await getConnection().get(counterKey)).toBe("1");
    });
  },
);
