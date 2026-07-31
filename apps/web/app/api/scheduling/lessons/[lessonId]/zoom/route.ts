import { NextResponse, type NextRequest } from "next/server";

import { setZoomMeetingInputSchema } from "../../../../../../../../packages/domain/scheduling/schemas";
import { setLessonZoomMeeting } from "../../../../../../../../packages/domain/scheduling/services";
import { apiSchedulingContext } from "../../../_context";
import { requestId, schedulingApiError } from "../../../_response";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ lessonId: string }> },
) {
  const id = requestId(request);
  try {
    const { lessonId } = await params;
    const context = await apiSchedulingContext(request);
    const input = setZoomMeetingInputSchema.parse(await request.json());
    const zoom = await setLessonZoomMeeting(context.database, context.actor, lessonId, input);
    return NextResponse.json({ data: zoom, requestId: id });
  } catch (error: unknown) {
    return schedulingApiError(error, id);
  }
}
