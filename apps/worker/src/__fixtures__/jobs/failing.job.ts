import { defineJob } from "../../job";
import { objectSchema } from "./schema-helper";

interface Payload {
  marker: string;
}

function isPayload(input: unknown): input is Payload {
  return (
    typeof input === "object" &&
    input !== null &&
    typeof (input as { marker?: unknown }).marker === "string"
  );
}

/** Always throws. Small fixed backoff keeps the retry -> DLQ test fast. */
export default defineJob<Payload>({
  name: "fixtures.failing",
  queue: "fixtures-failing",
  schema: objectSchema(isPayload, "marker must be a string"),
  options: {
    attempts: 3,
    backoff: { type: "fixed", delay: 20 },
  },
  async handler(data) {
    throw new Error(`fixtures.failing always fails (marker: ${data.marker})`);
  },
});
