import { NextResponse, type NextRequest } from "next/server";
import { challengeSchema } from "../../../../../../packages/domain/gamification/schemas";
import { createSeasonalChallenge } from "../../../../../../packages/domain/gamification/services";
import { apiGamificationContext } from "../_context";
import { gamificationApiError, gamificationRequestId } from "../_response";

export async function POST(request: NextRequest) {
  const requestId = gamificationRequestId(request);
  try {
    const context = await apiGamificationContext(request);
    const challenge = await createSeasonalChallenge(
      context.database,
      context.actor,
      challengeSchema.parse(await request.json()),
    );
    return NextResponse.json({ data: challenge, requestId }, { status: 201 });
  } catch (error) {
    return gamificationApiError(error, requestId);
  }
}
