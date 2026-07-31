import { NextResponse, type NextRequest } from "next/server";
import { competitionPreferenceSchema } from "../../../../../../packages/domain/gamification/schemas";
import { setCompetitionPreference } from "../../../../../../packages/domain/gamification/services";
import { apiGamificationContext } from "../_context";
import { gamificationApiError, gamificationRequestId } from "../_response";

export async function PATCH(request: NextRequest) {
  const requestId = gamificationRequestId(request);
  try {
    const context = await apiGamificationContext(request);
    await setCompetitionPreference(
      context.database,
      context.actor,
      competitionPreferenceSchema.parse(await request.json()),
    );
    return NextResponse.json({ data: { saved: true }, requestId });
  } catch (error) {
    return gamificationApiError(error, requestId);
  }
}
