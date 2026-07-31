import { createDb } from "@app/db";

import { defineJob } from "../../job";
import { isObject, objectSchema } from "../notifications/_schema";
import { createDrizzleSchedulingDatabase } from "../../../../../packages/domain/scheduling/drizzle-database";
import { listActiveLessonSeriesIds } from "../../../../../packages/domain/scheduling/materialization";
import { materializeUpcomingLessons } from "../../../../../packages/domain/scheduling/services";

type Payload = { horizonDays?: number };

const schema = objectSchema<Payload>(
  (value): value is Payload =>
    isObject(value) &&
    (value.horizonDays === undefined ||
      (typeof value.horizonDays === "number" &&
        Number.isInteger(value.horizonDays) &&
        value.horizonDays >= 7 &&
        value.horizonDays <= 180)),
);

function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Extends every active `lesson_series` up to `horizonDays` ahead (default 60), so a series with
 * no `end_date` keeps having concrete `lessons` rows available for the calendar/reminders/Zoom
 * setup instead of only what was materialized at `createLessonSeries` time. Idempotent by
 * construction: `materializeUpcomingLessons` dedupes against already-materialized start times
 * (see services.ts), so re-running this daily is always safe.
 */
export default defineJob({
  name: "scheduling.materialize-lessons",
  queue: "scheduling",
  schema,
  async handler(data, context) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) throw new Error("DATABASE_URL is required for scheduling materialization.");
    const db = createDb(databaseUrl);
    const schedulingDatabase = createDrizzleSchedulingDatabase(db);

    const horizonDays = data.horizonDays ?? 60;
    const horizonEndDate = formatDateOnly(new Date(Date.now() + horizonDays * 24 * 60 * 60 * 1000));
    const seriesIds = await listActiveLessonSeriesIds(db);

    let lessonsCreated = 0;
    for (const seriesId of seriesIds) {
      const created = await materializeUpcomingLessons(
        schedulingDatabase,
        seriesId,
        horizonEndDate,
      );
      lessonsCreated += created.length;
    }

    context.log.info(
      { seriesScanned: seriesIds.length, lessonsCreated, horizonEndDate },
      "materialized upcoming lessons for active series",
    );
  },
  options: {
    repeat: { pattern: "0 3 * * *" }, // daily at 03:00
    repeatPayload: {},
  },
});
