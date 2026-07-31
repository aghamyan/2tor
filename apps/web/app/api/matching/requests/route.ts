import { NextResponse, type NextRequest } from "next/server";

import {
  listAdminMatchingQueue,
  requestTutorChange,
} from "../../../../../../packages/domain/matching/services";
import { tutorChangeRequestInputSchema } from "../../../../../../packages/domain/matching/schemas";
import { apiMatchingContext } from "../_context";
import { matchingApiError, requestId } from "../_response";

/** Staff-only queue of pending parent tutor-change requests. */
export async function GET(request: NextRequest) {
  const id = requestId(request);
  try {
    const context = await apiMatchingContext(request);
    const requests = await listAdminMatchingQueue(context.database, context.actor);
    return NextResponse.json({ data: requests, requestId: id });
  } catch (error: unknown) {
    return matchingApiError(error, id);
  }
}

/** Linked parents create queue requests; they cannot make an assignment themselves. */
export async function POST(request: NextRequest) {
  const id = requestId(request);
  try {
    const context = await apiMatchingContext(request);
    const input = tutorChangeRequestInputSchema.parse(await request.json());
    const matchingRequest = await requestTutorChange(context.database, context.actor, input);
    return NextResponse.json({ data: matchingRequest, requestId: id }, { status: 201 });
  } catch (error: unknown) {
    return matchingApiError(error, id);
  }
}
