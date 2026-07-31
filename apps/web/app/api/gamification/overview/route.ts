import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getGamificationSummary } from "../../../../../../packages/domain/gamification/services";
import { apiGamificationContext } from "../_context";
import { gamificationApiError, gamificationRequestId } from "../_response";

const querySchema = z.object({ studentProfileId: z.string().trim().min(1).max(180) });

export async function GET(request: NextRequest) {
  const requestId = gamificationRequestId(request);
  try {
    const query = querySchema.parse({
      studentProfileId: request.nextUrl.searchParams.get("studentProfileId"),
    });
    const context = await apiGamificationContext(request);
    return NextResponse.json({
      data: await getGamificationSummary(context.database, context.actor, query.studentProfileId),
      requestId,
    });
  } catch (error) {
    return gamificationApiError(error, requestId);
  }
}
