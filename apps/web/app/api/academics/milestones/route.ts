import { NextResponse, type NextRequest } from "next/server";
import { milestoneSchema } from "../../../../../../packages/domain/academics/schemas";
import { createMilestone } from "../../../../../../packages/domain/academics/services";
import { authorizeAcademicRecord } from "../../../(app)/academics/authorization";
import { apiAcademicContext } from "../_context";
import { academicApiError, academicRequestId } from "../_response";
export async function POST(request: NextRequest) {
  const requestId = academicRequestId(request);
  try {
    const context = await apiAcademicContext(request);
    const input = milestoneSchema.parse(await request.json());
    await authorizeAcademicRecord(
      context.database,
      context.actor,
      input.studentProfileId,
      "academic.edit_learning_plan",
    );
    return NextResponse.json(
      { data: await createMilestone(context.database, context.actor, input), requestId },
      { status: 201 },
    );
  } catch (error) {
    return academicApiError(error, requestId);
  }
}
