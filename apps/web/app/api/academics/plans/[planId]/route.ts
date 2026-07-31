import { NextResponse, type NextRequest } from "next/server";
import { reviseLearningPlanSchema } from "../../../../../../../packages/domain/academics/schemas";
import { AcademicError } from "../../../../../../../packages/domain/academics/errors";
import { reviseLearningPlan } from "../../../../../../../packages/domain/academics/services";
import { authorizeAcademicRecord } from "../../../../(app)/academics/authorization";
import { apiAcademicContext } from "../../_context";
import { academicApiError, academicRequestId } from "../../_response";
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ planId: string }> },
) {
  const requestId = academicRequestId(request);
  try {
    const context = await apiAcademicContext(request);
    const { planId } = await params;
    const plan = await context.database.getLearningPlan(planId);
    if (!plan) throw new AcademicError("PLAN_NOT_FOUND", "Learning plan was not found.", 404);
    await authorizeAcademicRecord(
      context.database,
      context.actor,
      plan.studentProfileId,
      "academic.edit_learning_plan",
    );
    const result = await reviseLearningPlan(
      context.database,
      context.actor,
      planId,
      reviseLearningPlanSchema.parse(await request.json()),
    );
    return NextResponse.json({ data: result, requestId });
  } catch (error) {
    return academicApiError(error, requestId);
  }
}
