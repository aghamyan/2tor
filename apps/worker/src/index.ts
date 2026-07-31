import process from "node:process";
import path from "node:path";

import type { Worker } from "bullmq";

import {
  closeConnection,
  closeQueues,
  createWorkerForQueue,
  getQueueStats,
  groupByQueue,
  logger,
} from "./queue";
import { discoverJobs } from "./registry";
import { registerSchedules } from "./schedule";

/** apps/worker/src -> apps/worker -> apps -> repo root, where `.env` lives (see docs/INFRA.md). */
const REPO_ROOT_ENV_PATH = path.join(import.meta.dirname, "..", "..", "..", ".env");

async function main(): Promise<void> {
  try {
    process.loadEnvFile(REPO_ROOT_ENV_PATH);
  } catch {
    // No root .env file (e.g. containers get REDIS_URL from docker-compose's env_file instead).
  }

  const discovered = await discoverJobs();
  logger.info(
    { jobCount: discovered.length, jobs: discovered.map((job) => job.definition.name) },
    "discovered jobs",
  );

  const workers: Worker[] = [];
  for (const [queueName, definitions] of groupByQueue(discovered)) {
    workers.push(createWorkerForQueue(queueName, definitions));
    logger.info(
      { queue: queueName, jobs: definitions.map((job) => job.definition.name) },
      "worker started",
    );
  }

  const scheduled = await registerSchedules(discovered);
  if (scheduled.length > 0) {
    logger.info({ count: scheduled.length }, "repeatable schedules registered");
  }

  logger.info("worker ready");

  // A BullMQ Worker's own Redis connection normally keeps the event loop alive; with zero jobs
  // discovered (e.g. no domain module has shipped a *.job.ts yet) there'd otherwise be nothing
  // pending and the process would exit right after this line. Keep the service up regardless.
  const keepAlive = setInterval(() => {}, 2 ** 31 - 1);

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    logger.info({ signal }, "shutting down worker");
    clearInterval(keepAlive);
    await Promise.all(workers.map((worker) => worker.close()));
    await closeQueues();
    await closeConnection();
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

void main();

/** Re-exported so Administration (D17) has one documented entrypoint for queue admin visibility. */
export { getQueueStats };
