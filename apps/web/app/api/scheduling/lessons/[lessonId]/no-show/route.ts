import { NextResponse, type NextRequest } from "next/server";

import { recordNoShowInputSchema } from "../../../../../../../../packages/domain/scheduling/schemas";
import { recordNoShow } from "../../../../../../../../packages/domain/scheduling/services";
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
    const input = recordNoShowInputSchema.parse(await request.json());
    const result = await recordNoShow(context.database, context.actor, lessonId, input);
    return NextResponse.json({ data: result, requestId: id });
  } catch (error: unknown) {
    return schedulingApiError(error, id);
  }
}
