import type { BackoffOptions, RepeatOptions } from "bullmq";

/**
 * Structural, not nominal: any object exposing Zod's `parse`/`safeParse` shape satisfies this,
 * so this file never imports the `zod` package itself (it isn't resolvable from `apps/worker` —
 * only packages that declare it as a direct dependency get it under pnpm's strict linking).
 * A `z.object({...})` schema built by a job module satisfies this interface with no adapter.
 */
export interface JobSchema<TOutput> {
  parse(input: unknown): TOutput;
  safeParse(input: unknown): { success: true; data: TOutput } | { success: false; error: unknown };
}

/**
 * Deliberately a hand-rolled structural interface, not `typeof` @app/observability's pino
 * `Logger` — that package's barrel currently fails to resolve at runtime from apps/worker (its
 * `sentry.ts` imports `@app/config`, which isn't declared as an observability dependency; see
 * apps/worker/README.md). `queue.ts` provides an interim implementation satisfying this same
 * shape, so swapping back once that's fixed is a one-line import change, not a type change.
 */
export interface JobLogger {
  info(bindings: Record<string, unknown> | string, message?: string): void;
  warn(bindings: Record<string, unknown> | string, message?: string): void;
  error(bindings: Record<string, unknown> | string, message?: string): void;
  child(bindings: Record<string, unknown>): JobLogger;
}

/** Passed to every job handler in addition to its validated input. */
export interface JobContext {
  /** The BullMQ job id (unique per enqueued job, not per logical operation). */
  jobId: string;
  queue: string;
  name: string;
  /** 1 on the first attempt, incrementing on each retry. */
  attemptsMade: number;
  log: JobLogger;
}

export interface JobOptions<TInput> {
  /** Max attempts before a job is considered permanently failed and moved to the dead-letter queue. Defaults to 3. */
  attempts?: number;
  /** Defaults to exponential backoff starting at 1s. */
  backoff?: BackoffOptions;
  /**
   * Marks this job as high-risk: re-running it for the same logical operation must be a no-op.
   * Once a job with a given idempotency key completes successfully, later jobs presenting the
   * same key skip the handler entirely (see apps/worker/README.md for the full contract).
   */
  idempotent?: boolean;
  /**
   * Derives the idempotency key from validated job input. Required when `idempotent` is true;
   * ignored otherwise. Defaults are deliberately not provided — a job author must state which
   * field(s) make a repeated submission "the same operation."
   */
  idempotencyKey?: (data: TInput) => string;
  /** How long a completed idempotency key is remembered, in seconds. Defaults to 7 days. */
  idempotencyTtlSeconds?: number;
  /** Present only on repeatable (cron) jobs; consumed by the schedule loader, not by direct enqueues. */
  repeat?: RepeatOptions;
  /** Payload passed to the handler on each repeat tick. Defaults to `{}`. Must satisfy `schema`. */
  repeatPayload?: unknown;
}

/** The shape every `*.job.ts` file must export (default export, or one or more named exports). */
export interface JobDefinition<TInput = unknown> {
  /** Globally unique across the whole registry; used as the BullMQ job name and DLQ/idempotency key namespace. */
  name: string;
  /** BullMQ queue name. Jobs sharing a queue name are processed by one Worker, dispatched by `name`. */
  queue: string;
  schema: JobSchema<TInput>;
  handler: (data: TInput, ctx: JobContext) => Promise<void>;
  options?: JobOptions<TInput>;
}

/** Type-inference helper for job authors: `export default defineJob({ ... })`. Performs no validation itself. */
export function defineJob<TInput>(definition: JobDefinition<TInput>): JobDefinition<TInput> {
  return definition;
}

export const DEFAULT_ATTEMPTS = 3;
export const DEFAULT_BACKOFF: BackoffOptions = { type: "exponential", delay: 1000 };
export const DEFAULT_IDEMPOTENCY_TTL_SECONDS = 60 * 60 * 24 * 7;
