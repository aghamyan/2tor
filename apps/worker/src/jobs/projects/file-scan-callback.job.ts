import { createDb } from "@app/db";
import { createDrizzleProjectsDatabase } from "../../../../../packages/domain/projects/drizzle-database";
import { recordProjectFileScanResult } from "../../../../../packages/domain/projects/services";
import { defineJob } from "../../job";
import { isObject, objectSchema } from "../notifications/_schema";

type Payload = { fileId: string; status: "clean" | "infected" | "error" };
const schema = objectSchema<Payload>(
  (value): value is Payload =>
    isObject(value) &&
    typeof value.fileId === "string" &&
    ["clean", "infected", "error"].includes(String(value.status)),
);

/** Scanner integrations enqueue this only after a definitive result; pending objects stay private. */
export default defineJob({
  name: "projects.file-scan-callback",
  queue: "projects",
  schema,
  async handler(data, context) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) throw new Error("DATABASE_URL is required for project scan callbacks.");
    await recordProjectFileScanResult(
      createDrizzleProjectsDatabase(createDb(databaseUrl)),
      data.fileId,
      data.status,
    );
    context.log.info(
      { fileId: data.fileId, status: data.status },
      "project file scan status recorded",
    );
  },
  options: { idempotent: true, idempotencyKey: (data) => `${data.fileId}:${data.status}` },
});
