import { NextResponse, type NextRequest } from "next/server";

import { proposeAssignment } from "../../../../../../packages/domain/matching/services";
import { proposeAssignmentInputSchema } from "../../../../../../packages/domain/matching/schemas";
import { apiMatchingContext } from "../_context";
import { matchingApiError, requestId } from "../_response";

/** Administrator creates a proposal. It remains non-authorizing until tutor acceptance. */
export async function POST(request: NextRequest) {
  const id = requestId(request);
  try {
    const context = await apiMatchingContext(request);
    const input = proposeAssignmentInputSchema.parse(await request.json());
    const assignment = await proposeAssignment(context.database, context.actor, input);
    return NextResponse.json({ data: assignment, requestId: id }, { status: 201 });
  } catch (error: unknown) {
    return matchingApiError(error, id);
  }
}
