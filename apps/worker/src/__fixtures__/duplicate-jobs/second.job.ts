import { defineJob } from "../../job";
import { objectSchema } from "../jobs/schema-helper";

function isEmpty(input: unknown): input is Record<string, never> {
  return typeof input === "object" && input !== null;
}

export default defineJob({
  name: "fixtures.duplicate",
  queue: "fixtures-duplicate-b",
  schema: objectSchema(isEmpty, "payload must be an object"),
  async handler() {},
});
