import IORedis from "ioredis";

import { defineJob } from "../../job";
import { objectSchema } from "./schema-helper";

interface Payload {
  key: string;
  counterKey: string;
}

function isPayload(input: unknown): input is Payload {
  const candidate = input as Partial<Payload> | null;
  return (
    typeof candidate === "object" &&
    candidate !== null &&
    typeof candidate.key === "string" &&
    typeof candidate.counterKey === "string"
  );
}

let connection: IORedis | undefined;
function redis(): IORedis {
  connection ??= new IORedis(mustGetRedisUrl(), { maxRetriesPerRequest: null });
  return connection;
}

function mustGetRedisUrl(): string {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error("REDIS_URL must be set for fixture jobs to run.");
  }
  return url;
}

/**
 * High-risk fixture: increments `counterKey` on every real execution. Two jobs submitted with the
 * same `key` (BullMQ job id or not) must only increment the counter once — that's what the
 * `idempotent: true` + `idempotencyKey` contract in queue.ts is responsible for enforcing.
 */
export default defineJob<Payload>({
  name: "fixtures.idempotent",
  queue: "fixtures-idempotent",
  schema: objectSchema(isPayload, "key and counterKey must be strings"),
  options: {
    idempotent: true,
    idempotencyKey: (data) => data.key,
  },
  async handler(data, ctx) {
    await redis().incr(data.counterKey);
    ctx.log.info({ key: data.key }, "fixtures.idempotent ran");
  },
});
