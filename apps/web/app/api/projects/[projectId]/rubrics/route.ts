import { NextResponse, type NextRequest } from "next/server";
import { createProjectRubricSchema } from "../../../../../../../packages/domain/projects/schemas";
import { createAndAttachProjectRubric } from "../../../../../../../packages/domain/projects/services";
import { apiProjectContext } from "../../_context";
import { projectApiError, projectRequestId } from "../../_response";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const requestId = projectRequestId(request);
  try {
    const context = await apiProjectContext(request);
    const { projectId } = await params;
    const rubric = await createAndAttachProjectRubric(
      context.database,
      context.actor,
      projectId,
      createProjectRubricSchema.parse(await request.json()),
    );
    return NextResponse.json({ data: rubric, requestId }, { status: 201 });
  } catch (error) {
    return projectApiError(error, requestId);
  }
}
