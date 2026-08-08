import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getStudentMasteryMap } from "../../../../../../../packages/domain/academics/services";
import { authorizeAcademicRecord } from "../../../../(app)/academics/authorization";
import { apiAcademicContext } from "../../_context";
import { academicApiError, academicRequestId } from "../../_response";

const querySchema = z.object({
  studentProfileId: z.string().trim().min(1).max(100),
  subjectId: z.string().trim().min(1).max(100),
});

export async function GET(request: NextRequest) {
  const requestId = academicRequestId(request);
  try {
    const query = querySchema.parse({
      studentProfileId: request.nextUrl.searchParams.get("studentProfileId"),
      subjectId: request.nextUrl.searchParams.get("subjectId"),
    });
    const context = await apiAcademicContext(request);
    await authorizeAcademicRecord(
      context.database,
      context.actor,
      query.studentProfileId,
      "academic.view_record",
    );
    const map = await getStudentMasteryMap(
      context.database,
      context.actor,
      query.studentProfileId,
      query.subjectId,
    );
    return NextResponse.json({ data: map, requestId });
  } catch (error) {
    return academicApiError(error, requestId);
  }
}
