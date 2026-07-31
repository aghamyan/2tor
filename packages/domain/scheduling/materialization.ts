import { lessonSeries, type Database } from "@app/db";
import { asc, eq } from "drizzle-orm";

/**
 * System-level scan (no actor, `@app/db`-direct — see reminders.ts/chargeable-events.ts for the
 * same pattern) the materialization worker job uses to find every series it needs to extend.
 */
export async function listActiveLessonSeriesIds(
  database: Database,
  limit = 500,
): Promise<string[]> {
  const rows = await database
    .select({ id: lessonSeries.id })
    .from(lessonSeries)
    .where(eq(lessonSeries.status, "active"))
    .orderBy(asc(lessonSeries.id))
    .limit(limit);
  return rows.map((row) => row.id);
}
