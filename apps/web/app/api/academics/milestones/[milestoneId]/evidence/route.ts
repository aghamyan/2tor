import { NextResponse, type NextRequest } from "next/server";
import { milestoneEvidenceSchema } from "../../../../../../../../packages/domain/academics/schemas";
import { AcademicError } from "../../../../../../../../packages/domain/academics/errors";
import { addMilestoneEvidence } from "../../../../../../../../packages/domain/academics/services";
import { authorizeAcademicRecord } from "../../../../../(app)/academics/authorization";
import { apiAcademicContext } from "../../../_context";
import { academicApiError, academicRequestId } from "../../../_response";
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ milestoneId: string }> },
) {
  const requestId = academicRequestId(request);
  try {
    const context = await apiAcademicContext(request);
    const { milestoneId } = await params;
    const milestone = await context.database.getMilestone(milestoneId);
    if (!milestone) throw new AcademicError("MILESTONE_NOT_FOUND", "Milestone was not found.", 404);
    await authorizeAcademicRecord(
      context.database,
      context.actor,
      milestone.studentProfileId,
      "academic.edit_learning_plan",
    );
    return NextResponse.json(
      {
        data: await addMilestoneEvidence(
          context.database,
          context.actor,
          milestoneId,
          milestoneEvidenceSchema.parse(await request.json()),
        ),
        requestId,
      },
      { status: 201 },
    );
  } catch (error) {
    return academicApiError(error, requestId);
  }
}
