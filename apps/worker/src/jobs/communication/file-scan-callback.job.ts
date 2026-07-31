import { createDb } from "@app/db";

import { createDrizzleCommunicationDatabase } from "../../../../../packages/domain/communication/drizzle-database";
import { recordAttachmentScanResult } from "../../../../../packages/domain/communication/services";
import { defineJob } from "../../job";
import { isObject, objectSchema } from "../notifications/_schema";

type Payload = { attachmentId: string; status: "clean" | "infected" | "error" };
const schema = objectSchema<Payload>(
  (value): value is Payload =>
    isObject(value) &&
    typeof value.attachmentId === "string" &&
    ["clean", "infected", "error"].includes(String(value.status)),
);

/** Scanner integrations enqueue this only after a definitive result; pending files stay private. */
export default defineJob({
  name: "communication.file-scan-callback",
  queue: "communication",
  schema,
  async handler(data, context) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error("DATABASE_URL is required for communication scan callbacks.");
    }
    await recordAttachmentScanResult(
      createDrizzleCommunicationDatabase(createDb(databaseUrl)),
      data.attachmentId,
      data.status,
    );
    context.log.info(
      { attachmentId: data.attachmentId, status: data.status },
      "communication attachment scan status recorded",
    );
  },
  options: {
    idempotent: true,
    idempotencyKey: (data) => `${data.attachmentId}:${data.status}`,
  },
});
