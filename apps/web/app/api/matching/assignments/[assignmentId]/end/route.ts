import { NextResponse, type NextRequest } from "next/server";

import { endAssignmentInputSchema } from "../../../../../../../../packages/domain/matching/schemas";
import { endAssignment } from "../../../../../../../../packages/domain/matching/services";
import { apiMatchingContext } from "../../../_context";
import { matchingApiError, requestId } from "../../../_response";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ assignmentId: string }> },
) {
  const id = requestId(request);
  try {
    const context = await apiMatchingContext(request);
    const { assignmentId } = await params;
    const input = endAssignmentInputSchema.parse(await request.json());
    const assignment = await endAssignment(context.database, context.actor, assignmentId, input);
    return NextResponse.json({ data: assignment, requestId: id });
  } catch (error: unknown) {
    return matchingApiError(error, id);
  }
}
