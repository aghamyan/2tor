import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSkillDetail } from "../../../../../../../../packages/domain/academics/services";
import { authorizeAcademicRecord } from "../../../../../(app)/academics/authorization";
import { apiAcademicContext } from "../../../_context";
import { academicApiError, academicRequestId } from "../../../_response";

const querySchema = z.object({ studentProfileId: z.string().trim().min(1).max(100) });

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ skillId: string }> },
) {
  const requestId = academicRequestId(request);
  try {
    const query = querySchema.parse({
      studentProfileId: request.nextUrl.searchParams.get("studentProfileId"),
    });
    const context = await apiAcademicContext(request);
    const { skillId } = await params;
    await authorizeAcademicRecord(
      context.database,
      context.actor,
      query.studentProfileId,
      "academic.view_record",
    );
    const detail = await getSkillDetail(
      context.database,
      context.actor,
      query.studentProfileId,
      skillId,
    );
    return NextResponse.json({ data: detail, requestId });
  } catch (error) {
    return academicApiError(error, requestId);
  }
}
