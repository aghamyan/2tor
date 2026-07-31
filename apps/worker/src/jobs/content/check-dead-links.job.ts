import { createDb } from "@app/db";
import { createDrizzleContentDatabase } from "../../../../../packages/domain/content/drizzle-database";
import { removeDeadLinks } from "../../../../../packages/domain/content/services";
import { defineJob } from "../../job";
import { isObject, objectSchema } from "../notifications/_schema";

type Payload = { scanLimit?: number };
const schema = objectSchema<Payload>(
  (value): value is Payload =>
    isObject(value) &&
    (value.scanLimit === undefined ||
      (typeof value.scanLimit === "number" &&
        Number.isInteger(value.scanLimit) &&
        value.scanLimit >= 1 &&
        value.scanLimit <= 1000)),
);
/** Uses HEAD only: link health checks never request or download video bodies. */
async function isLiveExternalLink(url: string) {
  try {
    const response = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
    });
    return response.ok;
  } catch {
    return false;
  }
}
export default defineJob({
  name: "content.check-dead-links",
  queue: "content",
  schema,
  async handler(data, context) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) throw new Error("DATABASE_URL is required for content jobs.");
    const removed = await removeDeadLinks(
      createDrizzleContentDatabase(createDb(databaseUrl)),
      isLiveExternalLink,
      data.scanLimit ?? 250,
    );
    context.log.info({ removedLinkIds: removed }, "content link health check complete");
  },
  options: { repeat: { pattern: "15 3 * * *" }, repeatPayload: {} },
});
