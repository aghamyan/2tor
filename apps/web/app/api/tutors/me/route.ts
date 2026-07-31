import { NextResponse, type NextRequest } from "next/server";

import { tutorProfileInputSchema } from "../../../../../../packages/domain/tutors/schemas";
import {
  createTutorProfile,
  updateTutorProfile,
} from "../../../../../../packages/domain/tutors/services";
import { apiTutorContext } from "../_context";
import { requestId, tutorApiError } from "../_response";

export async function GET(request: NextRequest) {
  const id = requestId(request);
  try {
    const context = await apiTutorContext(request);
    const profile = await context.database.findTutorProfileByUserId(context.actor.userId);
    return NextResponse.json({ data: profile, requestId: id });
  } catch (error: unknown) {
    return tutorApiError(error, id);
  }
}

export async function PUT(request: NextRequest) {
  const id = requestId(request);
  try {
    const context = await apiTutorContext(request);
    const input = tutorProfileInputSchema.parse(await request.json());
    const existing = await context.database.findTutorProfileByUserId(context.actor.userId);
    const profile = existing
      ? await updateTutorProfile(context.database, context.actor, input)
      : await createTutorProfile(context.database, context.actor, input);
    return NextResponse.json({ data: profile, requestId: id }, { status: existing ? 200 : 201 });
  } catch (error: unknown) {
    return tutorApiError(error, id);
  }
}
