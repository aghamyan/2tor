import { NextResponse, type NextRequest } from "next/server";
import { getProjectForActor } from "../../../../../../packages/domain/projects/services";
import { apiProjectContext } from "../_context";
import { projectApiError, projectRequestId } from "../_response";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const requestId = projectRequestId(request);
  try {
    const context = await apiProjectContext(request);
    const { projectId } = await params;
    return NextResponse.json({
      data: await getProjectForActor(context.database, context.actor, projectId),
      requestId,
    });
  } catch (error) {
    return projectApiError(error, requestId);
  }
}
