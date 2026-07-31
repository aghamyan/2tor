import { NextResponse, type NextRequest } from "next/server";
import { createProjectSchema } from "../../../../../packages/domain/projects/schemas";
import { createProject } from "../../../../../packages/domain/projects/services";
import { apiProjectContext } from "./_context";
import { projectApiError, projectRequestId } from "./_response";

export async function POST(request: NextRequest) {
  const requestId = projectRequestId(request);
  try {
    const context = await apiProjectContext(request);
    const project = await createProject(
      context.database,
      context.actor,
      createProjectSchema.parse(await request.json()),
    );
    return NextResponse.json({ data: project, requestId }, { status: 201 });
  } catch (error) {
    return projectApiError(error, requestId);
  }
}
