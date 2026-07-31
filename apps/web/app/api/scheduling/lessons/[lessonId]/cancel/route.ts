import { NextResponse, type NextRequest } from "next/server";

import { cancelLessonInputSchema } from "../../../../../../../../packages/domain/scheduling/schemas";
import { cancelLesson } from "../../../../../../../../packages/domain/scheduling/services";
import { apiSchedulingContext } from "../../../_context";
import { requestId, schedulingApiError } from "../../../_response";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ lessonId: string }> },
) {
  const id = requestId(request);
  try {
    const { lessonId } = await params;
    const context = await apiSchedulingContext(request);
    const input = cancelLessonInputSchema.parse(await request.json());
    const result = await cancelLesson(context.database, context.actor, lessonId, input);
    return NextResponse.json({ data: result, requestId: id });
  } catch (error: unknown) {
    return schedulingApiError(error, id);
  }
}
