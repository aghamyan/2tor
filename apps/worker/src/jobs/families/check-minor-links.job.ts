import { createDb } from "@app/db";

import { defineJob } from "../../job";
import { isObject, objectSchema } from "../notifications/_schema";
import { findMinorStudentsWithoutParent } from "../../../../../packages/domain/families/integrity";

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

export default defineJob({
  name: "families.check-minor-links",
  queue: "families",
  schema,
  async handler(data, context) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) throw new Error("DATABASE_URL is required for family integrity jobs.");
    const db = createDb(databaseUrl);
    const studentProfileIds = await findMinorStudentsWithoutParent(db, data.scanLimit ?? 250);

    if (studentProfileIds.length > 0) {
      context.log.error(
        { orphanedMinorStudentIds: studentProfileIds },
        "minor students without a parent link detected",
      );
      return;
    }
    context.log.info("family link integrity check passed");
  },
  options: {
    repeat: { pattern: "0 4 * * *" },
    repeatPayload: {},
  },
});
