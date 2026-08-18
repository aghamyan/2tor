import { NextResponse, type NextRequest } from "next/server";

import { deleteLessonInputSchema } from "../../../../../../../packages/domain/scheduling/schemas";
import {
  deleteLesson,
  getLessonDetail,
} from "../../../../../../../packages/domain/scheduling/services";
import { apiSchedulingContext } from "../../_context";
import { requestId, schedulingApiError } from "../../_response";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ lessonId: string }> },
) {
  const id = requestId(request);
  try {
    const { lessonId } = await params;
    const context = await apiSchedulingContext(request);
    const detail = await getLessonDetail(context.database, context.actor, lessonId);
    return NextResponse.json({ data: detail, requestId: id });
  } catch (error: unknown) {
    return schedulingApiError(error, id);
  }
}

/** Hard-deletes a one-time, still-scheduled class — see services.ts `deleteLesson` for why a
 * series-linked occurrence is refused here (`LESSON_PART_OF_SERIES`) in favor of `DELETE
 * /api/scheduling/series/[seriesId]`. */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ lessonId: string }> },
) {
  const id = requestId(request);
  try {
    const { lessonId } = await params;
    const context = await apiSchedulingContext(request);
    const body = await request.text();
    const input = deleteLessonInputSchema.parse(body ? JSON.parse(body) : {});
    const result = await deleteLesson(context.database, context.actor, lessonId, input);
    return NextResponse.json({ data: result, requestId: id });
  } catch (error: unknown) {
    return schedulingApiError(error, id);
  }
}
