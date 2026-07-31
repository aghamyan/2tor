import { NextResponse, type NextRequest } from "next/server";
import { createAssignmentSchema } from "../../../../../packages/domain/assignments/schemas";
import { createAssignment } from "../../../../../packages/domain/assignments/services";
import { apiAssignmentContext } from "./_context";
import { assignmentApiError, assignmentRequestId } from "./_response";

export async function POST(request: NextRequest) {
  const requestId = assignmentRequestId(request);
  try {
    const context = await apiAssignmentContext(request);
    const assignment = await createAssignment(
      context.database,
      context.actor,
      createAssignmentSchema.parse(await request.json()),
    );
    return NextResponse.json({ data: assignment, requestId }, { status: 201 });
  } catch (error) {
    return assignmentApiError(error, requestId);
  }
}
