import { NextResponse, type NextRequest } from "next/server";

import { deleteLessonSeriesInputSchema } from "../../../../../../../packages/domain/scheduling/schemas";
import { deleteLessonSeries } from "../../../../../../../packages/domain/scheduling/services";
import { apiSchedulingContext } from "../../_context";
import { requestId, schedulingApiError } from "../../_response";

/** Ends the series and hard-deletes every still-scheduled occurrence — see services.ts
 * `deleteLessonSeries`. Already-resolved (completed/canceled/no-show) occurrences are untouched. */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ seriesId: string }> },
) {
  const id = requestId(request);
  try {
    const { seriesId } = await params;
    const context = await apiSchedulingContext(request);
    const body = await request.text();
    const input = deleteLessonSeriesInputSchema.parse(body ? JSON.parse(body) : {});
    const result = await deleteLessonSeries(context.database, context.actor, seriesId, input);
    return NextResponse.json({ data: result, requestId: id });
  } catch (error: unknown) {
    return schedulingApiError(error, id);
  }
}
