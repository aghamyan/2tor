import { NextResponse, type NextRequest } from "next/server";

import { replaceAvailabilityInputSchema } from "../../../../../../../packages/domain/tutors/schemas";
import { replaceTutorAvailability } from "../../../../../../../packages/domain/tutors/services";
import { apiTutorContext } from "../../_context";
import { requestId, tutorApiError } from "../../_response";

export async function PUT(request: NextRequest) {
  const id = requestId(request);
  try {
    const context = await apiTutorContext(request);
    await replaceTutorAvailability(
      context.database,
      context.actor,
      replaceAvailabilityInputSchema.parse(await request.json()),
    );
    return NextResponse.json({ data: { saved: true }, requestId: id });
  } catch (error: unknown) {
    return tutorApiError(error, id);
  }
}
