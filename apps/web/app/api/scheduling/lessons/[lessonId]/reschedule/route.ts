import { NextResponse, type NextRequest } from "next/server";

import { rescheduleLessonInputSchema } from "../../../../../../../../packages/domain/scheduling/schemas";
import {
  getLessonDetail,
  listLessonsForActor,
  rescheduleLesson,
} from "../../../../../../../../packages/domain/scheduling/services";
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
    const input = rescheduleLessonInputSchema.parse(await request.json());
    const target = (await getLessonDetail(context.database, context.actor, lessonId)).lesson;

    if (input.scope === "this_lesson" || !target.lessonSeriesId) {
      const result = await rescheduleLesson(context.database, context.actor, lessonId, input);
      return NextResponse.json({
        data: { ...result, moved: [result], affectedCount: 1 },
        requestId: id,
      });
    }

    const shiftMs = input.newScheduledStartAt.getTime() - target.scheduledStartAt.getTime();
    const occurrences = (
      await listLessonsForActor(context.database, context.actor, {
        from:
          input.scope === "this_and_future"
            ? target.scheduledStartAt
            : new Date(target.scheduledStartAt.getTime() - 3 * 365 * 24 * 60 * 60_000),
        to: new Date(target.scheduledStartAt.getTime() + 3 * 365 * 24 * 60 * 60_000),
        limit: 500,
      })
    )
      .filter(
        (lesson) =>
          lesson.lessonSeriesId === target.lessonSeriesId && lesson.status === "scheduled",
      )
      .sort((a, b) => a.scheduledStartAt.getTime() - b.scheduledStartAt.getTime());

    const moved = [];
    for (const occurrence of occurrences) {
      const durationMinutes = Math.round(
        (occurrence.scheduledEndAt.getTime() - occurrence.scheduledStartAt.getTime()) / 60_000,
      );
      moved.push(
        await rescheduleLesson(context.database, context.actor, occurrence.id, {
          newScheduledStartAt: new Date(occurrence.scheduledStartAt.getTime() + shiftMs),
          durationMinutes,
          reason: input.reason,
          scope: "this_lesson",
        }),
      );
    }

    const targetResult = moved.find((result) => result.previous.id === target.id);
    if (!targetResult) {
      const result = await rescheduleLesson(context.database, context.actor, lessonId, {
        ...input,
        scope: "this_lesson",
      });
      return NextResponse.json({
        data: { ...result, moved: [result], affectedCount: 1 },
        requestId: id,
      });
    }
    return NextResponse.json({
      data: { ...targetResult, moved, affectedCount: moved.length },
      requestId: id,
    });
  } catch (error: unknown) {
    return schedulingApiError(error, id);
  }
}
