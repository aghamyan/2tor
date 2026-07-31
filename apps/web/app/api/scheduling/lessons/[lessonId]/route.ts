import { NextResponse, type NextRequest } from "next/server";

import { getLessonDetail } from "../../../../../../../packages/domain/scheduling/services";
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
