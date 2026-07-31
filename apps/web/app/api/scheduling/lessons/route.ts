import { NextResponse, type NextRequest } from "next/server";

import { createOneTimeLessonInputSchema } from "../../../../../../packages/domain/scheduling/schemas";
import {
  listLessonsForActor,
  scheduleOneTimeLesson,
} from "../../../../../../packages/domain/scheduling/services";
import { apiSchedulingContext } from "../_context";
import { requestId, schedulingApiError } from "../_response";

const DAY_MS = 24 * 60 * 60 * 1000;

export async function GET(request: NextRequest) {
  const id = requestId(request);
  try {
    const context = await apiSchedulingContext(request);
    const fromParam = request.nextUrl.searchParams.get("from");
    const toParam = request.nextUrl.searchParams.get("to");
    const limitParam = Number(request.nextUrl.searchParams.get("limit") ?? "100");
    const lessons = await listLessonsForActor(context.database, context.actor, {
      from: fromParam ? new Date(fromParam) : new Date(Date.now() - DAY_MS),
      to: toParam ? new Date(toParam) : new Date(Date.now() + 60 * DAY_MS),
      limit: Number.isFinite(limitParam) ? limitParam : 100,
    });
    return NextResponse.json({ data: lessons, requestId: id });
  } catch (error: unknown) {
    return schedulingApiError(error, id);
  }
}

export async function POST(request: NextRequest) {
  const id = requestId(request);
  try {
    const context = await apiSchedulingContext(request);
    const input = createOneTimeLessonInputSchema.parse(await request.json());
    const lesson = await scheduleOneTimeLesson(context.database, context.actor, input);
    return NextResponse.json({ data: lesson, requestId: id }, { status: 201 });
  } catch (error: unknown) {
    return schedulingApiError(error, id);
  }
}
