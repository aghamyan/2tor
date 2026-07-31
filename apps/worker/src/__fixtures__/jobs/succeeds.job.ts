import IORedis from "ioredis";

import { defineJob } from "../../job";
import { objectSchema } from "./schema-helper";

interface Payload {
  counterKey: string;
}

function isPayload(input: unknown): input is Payload {
  return (
    typeof input === "object" &&
    input !== null &&
    typeof (input as { counterKey?: unknown }).counterKey === "string"
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

/** Always succeeds; increments `counterKey` in Redis so tests can observe that the handler ran. */
export default defineJob<Payload>({
  name: "fixtures.succeeds",
  queue: "fixtures-succeeds",
  schema: objectSchema(isPayload, "counterKey must be a string"),
  async handler(data, ctx) {
    await redis().incr(data.counterKey);
    ctx.log.info({ counterKey: data.counterKey }, "fixtures.succeeds ran");
  },
});
