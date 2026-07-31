import { parentStudentLinks, studentProfiles, type Database } from "@app/db";
import { and, eq, notExists } from "drizzle-orm";

/** Read-only invariant scan used by the families worker job. It never repairs or activates users. */
export async function findMinorStudentsWithoutParent(
  database: Database,
  limit: number,
): Promise<string[]> {
  const rows = await database
    .select({ studentProfileId: studentProfiles.id })
    .from(studentProfiles)
    .where(
      and(
        eq(studentProfiles.isAdultLearner, false),
        notExists(
          database
            .select({ id: parentStudentLinks.id })
            .from(parentStudentLinks)
            .where(eq(parentStudentLinks.studentProfileId, studentProfiles.id)),
        ),
      ),
    )
    .limit(limit);
  return rows.map((row) => row.studentProfileId);
}
