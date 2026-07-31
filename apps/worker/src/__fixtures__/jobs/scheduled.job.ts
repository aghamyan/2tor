import { defineJob } from "../../job";
import { objectSchema } from "./schema-helper";

type Payload = Record<string, never>;

function isPayload(input: unknown): input is Payload {
  return typeof input === "object" && input !== null;
}

/** Repeatable fixture: the schedule loader should register this as a BullMQ repeatable job. */
export default defineJob<Payload>({
  name: "fixtures.scheduled",
  queue: "fixtures-scheduled",
  schema: objectSchema(isPayload, "payload must be an object"),
  options: {
    repeat: { pattern: "0 3 * * *" },
  },
  async handler(_data, ctx) {
    ctx.log.info("fixtures.scheduled ran");
  },
});
