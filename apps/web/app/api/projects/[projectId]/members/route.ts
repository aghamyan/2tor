import { NextResponse, type NextRequest } from "next/server";
import { addProjectMemberSchema } from "../../../../../../../packages/domain/projects/schemas";
import { addProjectMember } from "../../../../../../../packages/domain/projects/services";
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
    const member = await addProjectMember(
      context.database,
      context.actor,
      projectId,
      addProjectMemberSchema.parse(await request.json()),
    );
    return NextResponse.json({ data: member, requestId }, { status: 201 });
  } catch (error) {
    return projectApiError(error, requestId);
  }
}
