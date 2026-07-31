import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { acknowledgeMajorPlanChange } from "../../../../../../../../packages/domain/academics/services";
import { AcademicError } from "../../../../../../../../packages/domain/academics/errors";
import { authorizeAcademicRecord } from "../../../../../(app)/academics/authorization";
import { apiAcademicContext } from "../../../_context";
import { academicApiError, academicRequestId } from "../../../_response";
export async function POST(
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
      "academic.view_record",
    );
    const input = z
      .object({ versionNumber: z.number().int().positive() })
      .strict()
      .parse(await request.json());
    const result = await acknowledgeMajorPlanChange(
      context.database,
      context.actor,
      planId,
      input.versionNumber,
    );
    return NextResponse.json({ data: result, requestId });
  } catch (error) {
    return academicApiError(error, requestId);
  }
}
