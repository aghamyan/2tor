import { createDb } from "@app/db";
import { createDrizzleAssignmentsDatabase } from "../../../../../packages/domain/assignments/drizzle-database";
import { recordSubmissionFileScanResult } from "../../../../../packages/domain/assignments/services";
import { defineJob } from "../../job";
import { isObject, objectSchema } from "../notifications/_schema";

type Payload = { fileId: string; status: "clean" | "infected" | "error" };
const schema = objectSchema<Payload>(
  (value): value is Payload =>
    isObject(value) &&
    typeof value.fileId === "string" &&
    ["clean", "infected", "error"].includes(String(value.status)),
);

/** Scanner integrations enqueue this only after a definitive scan result; pending files remain private. */
export default defineJob({
  name: "assignments.file-scan-callback",
  queue: "assignments",
  schema,
  async handler(data, context) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) throw new Error("DATABASE_URL is required for assignment scan callbacks.");
    await recordSubmissionFileScanResult(
      createDrizzleAssignmentsDatabase(createDb(databaseUrl)),
      data.fileId,
      data.status,
    );
    context.log.info(
      { fileId: data.fileId, status: data.status },
      "assignment file scan status recorded",
    );
  },
  options: { idempotent: true, idempotencyKey: (data) => `${data.fileId}:${data.status}` },
});
