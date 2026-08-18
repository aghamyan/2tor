import { NextResponse, type NextRequest } from "next/server";
import { recordSkillAssessmentsSchema } from "../../../../../../../packages/domain/academics/schemas";
import { recordSkillAssessments } from "../../../../../../../packages/domain/academics/services";
import { authorizeAcademicRecord } from "../../../../(app)/academics/authorization";
import { apiAcademicContext } from "../../_context";
import { academicApiError, academicRequestId } from "../../_response";

/** Backs the tutor "class review" flow — records several topics observed in one session. */
export async function POST(request: NextRequest) {
  const requestId = academicRequestId(request);
  try {
    const context = await apiAcademicContext(request);
    const input = recordSkillAssessmentsSchema.parse(await request.json());
    await authorizeAcademicRecord(
      context.database,
      context.actor,
      input.studentProfileId,
      "academic.edit_learning_plan",
    );
    const events = await recordSkillAssessments(context.database, context.actor, input);
    return NextResponse.json({ data: events, requestId }, { status: 201 });
  } catch (error) {
    return academicApiError(error, requestId);
  }
}
