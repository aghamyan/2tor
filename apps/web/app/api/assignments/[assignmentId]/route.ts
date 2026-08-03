import { NextResponse, type NextRequest } from "next/server";
import { setAssignmentStatusSchema } from "../../../../../../packages/domain/assignments/schemas";
import {
  getAssignmentForActor,
  setAssignmentStatus,
} from "../../../../../../packages/domain/assignments/services";
import { apiAssignmentContext } from "../_context";
import { assignmentApiError, assignmentRequestId } from "../_response";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ assignmentId: string }> },
) {
  const requestId = assignmentRequestId(request);
  try {
    const context = await apiAssignmentContext(request);
    const { assignmentId } = await params;
    const assignment = await getAssignmentForActor(context.database, context.actor, assignmentId);
    return NextResponse.json({ data: assignment, requestId });
  } catch (error) {
    return assignmentApiError(error, requestId);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ assignmentId: string }> },
) {
  const requestId = assignmentRequestId(request);
  try {
    const context = await apiAssignmentContext(request);
    const { assignmentId } = await params;
    const assignment = await setAssignmentStatus(
      context.database,
      context.actor,
      assignmentId,
      setAssignmentStatusSchema.parse(await request.json()),
    );
    return NextResponse.json({ data: assignment, requestId });
  } catch (error) {
    return assignmentApiError(error, requestId);
  }
}
