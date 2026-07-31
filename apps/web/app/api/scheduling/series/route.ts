import { NextResponse, type NextRequest } from "next/server";

import { createLessonSeriesInputSchema } from "../../../../../../packages/domain/scheduling/schemas";
import { createLessonSeries } from "../../../../../../packages/domain/scheduling/services";
import { apiSchedulingContext } from "../_context";
import { requestId, schedulingApiError } from "../_response";

export async function POST(request: NextRequest) {
  const id = requestId(request);
  try {
    const context = await apiSchedulingContext(request);
    const input = createLessonSeriesInputSchema.parse(await request.json());
    const result = await createLessonSeries(context.database, context.actor, input);
    return NextResponse.json({ data: result, requestId: id }, { status: 201 });
  } catch (error: unknown) {
    return schedulingApiError(error, id);
  }
}
