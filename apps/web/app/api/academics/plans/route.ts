import { NextResponse, type NextRequest } from "next/server";
import { createLearningPlanSchema } from "../../../../../../packages/domain/academics/schemas";
import { createLearningPlan } from "../../../../../../packages/domain/academics/services";
import { authorizeAcademicRecord } from "../../../(app)/academics/authorization";
import { apiAcademicContext } from "../_context";
import { academicApiError, academicRequestId } from "../_response";
export async function POST(request: NextRequest) {
  const requestId = academicRequestId(request);
  try {
    const context = await apiAcademicContext(request);
    const input = createLearningPlanSchema.parse(await request.json());
    await authorizeAcademicRecord(
      context.database,
      context.actor,
      input.studentProfileId,
      "academic.edit_learning_plan",
    );
    const plan = await createLearningPlan(context.database, context.actor, input);
    return NextResponse.json({ data: plan, requestId }, { status: 201 });
  } catch (error) {
    return academicApiError(error, requestId);
  }
}
