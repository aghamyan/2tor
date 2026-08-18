import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiAcademicContext } from "../_context";
import { academicApiError, academicRequestId } from "../_response";

/** Curriculum reference data (units + topics) — not student-specific, so any authenticated actor may read it. */
const querySchema = z.object({ subjectId: z.string().trim().min(1).max(100) });

export async function GET(request: NextRequest) {
  const requestId = academicRequestId(request);
  try {
    const query = querySchema.parse({ subjectId: request.nextUrl.searchParams.get("subjectId") });
    const context = await apiAcademicContext(request);
    const [courses, skills] = await Promise.all([
      context.database.listCoursesForSubject(query.subjectId),
      context.database.listSkillsForSubject(query.subjectId),
    ]);
    const course = courses[0] ?? null;
    const units = course ? await context.database.listCurriculumUnits(course.id) : [];
    return NextResponse.json({ data: { course, units, skills }, requestId });
  } catch (error) {
    return academicApiError(error, requestId);
  }
}
