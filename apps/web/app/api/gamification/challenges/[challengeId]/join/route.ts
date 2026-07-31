import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { joinSeasonalChallenge } from "../../../../../../../../packages/domain/gamification/services";
import { apiGamificationContext } from "../../../_context";
import { gamificationApiError, gamificationRequestId } from "../../../_response";

const inputSchema = z.object({ studentProfileId: z.string().trim().min(1).max(180) }).strict();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ challengeId: string }> },
) {
  const requestId = gamificationRequestId(request);
  try {
    const [context, input, { challengeId }] = await Promise.all([
      apiGamificationContext(request),
      request.json().then((body: unknown) => inputSchema.parse(body)),
      params,
    ]);
    const progress = await joinSeasonalChallenge(
      context.database,
      context.actor,
      challengeId,
      input.studentProfileId,
    );
    return NextResponse.json({ data: progress, requestId }, { status: 201 });
  } catch (error) {
    return gamificationApiError(error, requestId);
  }
}
