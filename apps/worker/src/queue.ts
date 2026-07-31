import IORedis from "ioredis";
import { Queue, UnrecoverableError, Worker, type Job, type JobsOptions } from "bullmq";

import {
  DEFAULT_ATTEMPTS,
  DEFAULT_BACKOFF,
  DEFAULT_IDEMPOTENCY_TTL_SECONDS,
  type JobContext,
  type JobDefinition,
  type JobLogger,
} from "./job";
import type { DiscoveredJob } from "./registry";

const IDEMPOTENCY_KEY_PREFIX = "worker:idempotency";
/** Suffix applied to a queue's name to get its dead-letter queue name (":" is invalid in a BullMQ queue name). */
export const DEAD_LETTER_SUFFIX = "-dlq";

function jsonReplacer(_key: string, value: unknown): unknown {
  return value instanceof Error
    ? { name: value.name, message: value.message, stack: value.stack }
    : value;
}

/**
 * Minimal structured-JSON logger satisfying {@link JobLogger}. Interim stand-in for
 * `@app/observability`'s pino logger, which currently can't be imported from apps/worker at
 * runtime — see the docstring on `JobLogger` in job.ts and apps/worker/README.md.
 */
function createStructuredLogger(bindings: Record<string, unknown> = {}): JobLogger {
  function emit(
    level: "info" | "warn" | "error",
    first: Record<string, unknown> | string,
    message?: string,
  ): void {
    const extra = typeof first === "string" ? {} : first;
    const msg = typeof first === "string" ? first : message;
    const record = {
      level,
      time: new Date().toISOString(),
      ...bindings,
      ...extra,
      ...(msg ? { msg } : {}),
    };
    const line = JSON.stringify(record, jsonReplacer);
    if (level === "error") {
      console.error(line);
    } else {
      console.log(line);
    }
  }

  return {
    info: (first, message) => emit("info", first, message),
    warn: (first, message) => emit("warn", first, message),
    error: (first, message) => emit("error", first, message),
    child: (childBindings) => createStructuredLogger({ ...bindings, ...childBindings }),
  };
}

/** Shared top-level logger for worker lifecycle and dead-letter events. */
export const logger: JobLogger = createStructuredLogger();

function getRedisUrl(): string {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error(
      "REDIS_URL is not set. apps/worker reads it directly from process.env (see apps/worker/README.md's " +
        '"Configuration" section) until @app/config exposes a server-env entrypoint usable outside its own package.',
    );
  }
  return url;
}

let sharedConnection: IORedis | undefined;

/** One ioredis connection, shared by every Queue/Worker this process creates (BullMQ's recommended pattern). */
export function getConnection(): IORedis {
  sharedConnection ??= new IORedis(getRedisUrl(), { maxRetriesPerRequest: null });
  return sharedConnection;
}

export async function closeConnection(): Promise<void> {
  if (sharedConnection) {
    const connection = sharedConnection;
    sharedConnection = undefined;
    await connection.quit();
  }
}

const queues = new Map<string, Queue>();

/** Returns the cached `Queue` for `name`, creating it on first use. */
export function getQueue(name: string): Queue {
  let queue = queues.get(name);
  if (!queue) {
    queue = new Queue(name, { connection: getConnection() });
    queues.set(name, queue);
  }
  return queue;
}

/** The dead-letter queue a given queue's terminally-failed jobs are copied into. */
export function getDeadLetterQueue(queueName: string): Queue {
  return getQueue(`${queueName}${DEAD_LETTER_SUFFIX}`);
}

export async function closeQueues(): Promise<void> {
  const open = [...queues.values()];
  queues.clear();
  await Promise.all(open.map((queue) => queue.close()));
}

/** Splits a flat list of discovered jobs into one array per BullMQ queue name. */
export function groupByQueue(discovered: DiscoveredJob[]): Map<string, DiscoveredJob[]> {
  const grouped = new Map<string, DiscoveredJob[]>();
  for (const job of discovered) {
    const forQueue = grouped.get(job.definition.queue) ?? [];
    forQueue.push(job);
    grouped.set(job.definition.queue, forQueue);
  }
  return grouped;
}

function jobOptionsFor<TInput>(
  definition: JobDefinition<TInput>,
  overrides?: JobsOptions,
): JobsOptions {
  return {
    attempts: definition.options?.attempts ?? DEFAULT_ATTEMPTS,
    backoff: definition.options?.backoff ?? DEFAULT_BACKOFF,
    ...overrides,
  };
}

/** Enqueues one run of `definition` with `data` (validated against `definition.schema` first). */
export async function enqueueJob<TInput>(
  definition: JobDefinition<TInput>,
  data: TInput,
  overrides?: JobsOptions,
): Promise<Job> {
  definition.schema.parse(data);
  return getQueue(definition.queue).add(
    definition.name,
    data,
    jobOptionsFor(definition, overrides),
  );
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function idempotencyDoneKey(definition: JobDefinition, data: unknown): string {
  if (!definition.options?.idempotencyKey) {
    throw new Error(
      `Job "${definition.name}" sets options.idempotent but no options.idempotencyKey extractor was provided.`,
    );
  }
  const key = definition.options.idempotencyKey(data);
  return `${IDEMPOTENCY_KEY_PREFIX}:${definition.queue}:${definition.name}:${key}`;
}

async function runDefinition(definition: JobDefinition, job: Job, log: JobLogger): Promise<void> {
  const parsed = definition.schema.safeParse(job.data);
  if (!parsed.success) {
    log.error(
      { err: describeError(parsed.error) },
      "job payload failed schema validation; not retrying",
    );
    throw new UnrecoverableError(
      `Invalid payload for job "${definition.name}": ${describeError(parsed.error)}`,
    );
  }

  const connection = getConnection();
  const doneKey = definition.options?.idempotent
    ? idempotencyDoneKey(definition, parsed.data)
    : undefined;

  if (doneKey && (await connection.get(doneKey)) !== null) {
    log.info({ doneKey }, "skipping duplicate idempotent job");
    return;
  }

  const ctx: JobContext = {
    jobId: job.id ?? "unknown",
    queue: definition.queue,
    name: definition.name,
    attemptsMade: job.attemptsMade + 1,
    log,
  };

  await definition.handler(parsed.data, ctx);

  if (doneKey) {
    const ttl = definition.options?.idempotencyTtlSeconds ?? DEFAULT_IDEMPOTENCY_TTL_SECONDS;
    await connection.set(doneKey, "1", "EX", ttl);
  }
}

/**
 * One BullMQ Worker per queue; `definitions` must all share `queueName` (the registry groups them
 * with {@link groupByQueue} before calling this). The processor dispatches by `job.name`, so
 * several job types can live on one queue. Also wires dead-letter handling: see {@link attachDeadLetter}.
 */
export function createWorkerForQueue(queueName: string, definitions: DiscoveredJob[]): Worker {
  for (const { definition } of definitions) {
    if (definition.queue !== queueName) {
      throw new Error(
        `Job "${definition.name}" is registered under queue "${definition.queue}", expected "${queueName}".`,
      );
    }
  }
  const byName = new Map(definitions.map((d) => [d.definition.name, d.definition]));

  const worker = new Worker(
    queueName,
    async (job) => {
      const definition = byName.get(job.name);
      if (!definition) {
        throw new UnrecoverableError(
          `No job definition named "${job.name}" registered on queue "${queueName}".`,
        );
      }

      const log = logger.child({ queue: queueName, jobName: job.name, jobId: job.id });
      await runDefinition(definition, job, log);
    },
    { connection: getConnection() },
  );

  attachDeadLetter(worker, queueName);
  return worker;
}

/**
 * BullMQ has no built-in dead-letter queue: a job's `failed` event fires on every failed attempt,
 * including ones that will still be retried. `job.finishedOn` is only populated once BullMQ has
 * decided *not* to retry (attempts exhausted, or the handler threw `UnrecoverableError`) — that's
 * the terminal-failure signal this listens for before copying the job into `<queue>:dlq`.
 */
export function attachDeadLetter(worker: Worker, queueName: string): void {
  worker.on("failed", (job, err) => {
    void handleTerminalFailure(queueName, job, err);
  });
}

async function handleTerminalFailure(
  queueName: string,
  job: Job | undefined,
  err: Error,
): Promise<void> {
  if (!job || job.finishedOn === undefined) {
    return; // still has retries left; BullMQ will re-attempt it
  }

  await getDeadLetterQueue(queueName).add(
    job.name,
    {
      originalJobId: job.id,
      originalQueue: queueName,
      data: job.data,
      failedReason: err.message,
      attemptsMade: job.attemptsMade,
      failedAt: new Date().toISOString(),
    },
    { removeOnComplete: true },
  );

  logger.error(
    { queue: queueName, jobName: job.name, jobId: job.id, err },
    "job moved to dead-letter queue",
  );
}

const JOB_COUNT_STATES = ["waiting", "active", "completed", "failed", "delayed", "paused"] as const;

export interface QueueStats {
  queue: string;
  counts: Record<(typeof JOB_COUNT_STATES)[number], number>;
  deadLetter: {
    queue: string;
    counts: Record<(typeof JOB_COUNT_STATES)[number], number>;
  };
}

/**
 * Pure admin-visibility hook: job counts (by state) for each queue plus its dead-letter queue.
 * Exported for Administration (D17) to call. Apps can't cleanly import from other apps in this
 * repo, so wiring this into an actual admin surface (HTTP route, RPC, etc.) is D17's concern —
 * this function only needs a Redis connection (via {@link getConnection}) and a list of queue names.
 */
export async function getQueueStats(queueNames: string[]): Promise<QueueStats[]> {
  return Promise.all(
    queueNames.map(async (queue) => {
      const [counts, deadLetterCounts] = await Promise.all([
        getQueue(queue).getJobCounts(...JOB_COUNT_STATES),
        getDeadLetterQueue(queue).getJobCounts(...JOB_COUNT_STATES),
      ]);
      return {
        queue,
        counts: counts as QueueStats["counts"],
        deadLetter: {
          queue: `${queue}${DEAD_LETTER_SUFFIX}`,
          counts: deadLetterCounts as QueueStats["counts"],
        },
      };
    }),
  );
}
