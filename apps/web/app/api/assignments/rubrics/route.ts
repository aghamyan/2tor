import { NextResponse, type NextRequest } from "next/server";
import { createRubricSchema } from "../../../../../../packages/domain/assignments/schemas";
import {
  createAssignmentRubric,
  listAssignmentRubrics,
} from "../../../../../../packages/domain/assignments/services";
import { apiAssignmentContext } from "../_context";
import { assignmentApiError, assignmentRequestId } from "../_response";

export async function GET(request: NextRequest) {
  const requestId = assignmentRequestId(request);
  try {
    const context = await apiAssignmentContext(request);
    const rubrics = await listAssignmentRubrics(context.database, context.actor);
    return NextResponse.json({ data: rubrics, requestId });
  } catch (error) {
    return assignmentApiError(error, requestId);
  }
}

export async function POST(request: NextRequest) {
  const requestId = assignmentRequestId(request);
  try {
    const context = await apiAssignmentContext(request);
    const rubric = await createAssignmentRubric(
      context.database,
      context.actor,
      createRubricSchema.parse(await request.json()),
    );
    return NextResponse.json({ data: rubric, requestId }, { status: 201 });
  } catch (error) {
    return assignmentApiError(error, requestId);
  }
}
