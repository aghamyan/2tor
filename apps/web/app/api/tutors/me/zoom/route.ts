import { NextResponse, type NextRequest } from "next/server";

import { applyTutorZoomDefaultsToUpcomingLessons } from "../../../../../../../packages/domain/scheduling/services";
import { apiSchedulingContext } from "../../../scheduling/_context";
import { tutorZoomDefaultsInputSchema } from "../../../../../../../packages/domain/tutors/schemas";
import { updateTutorZoomDefaults } from "../../../../../../../packages/domain/tutors/services";
import { apiTutorContext } from "../../_context";
import { requestId, tutorApiError } from "../../_response";

export async function GET(request: NextRequest) {
  const id = requestId(request);
  try {
    const context = await apiTutorContext(request);
    const profile = await context.database.findTutorProfileByUserId(context.actor.userId);
    return NextResponse.json({
      data: {
        defaultZoomJoinUrl: profile?.defaultZoomJoinUrl ?? null,
        defaultZoomPasscode: profile?.defaultZoomPasscode ?? null,
      },
      requestId: id,
    });
  } catch (error: unknown) {
    return tutorApiError(error, id);
  }
}

/**
 * Saves the tutor's default Zoom settings, then immediately backfills any of their already-
 * scheduled lessons that have no Zoom row yet (see `applyTutorZoomDefaultsToUpcomingLessons`'s
 * file comment in `packages/domain/scheduling/services.ts` for why this is needed — lesson
 * creation-time auto-assign alone would only cover classes booked after this save). Two domains,
 * one request: mirrors `apps/web/app/(app)/tutors/queries.ts` importing scheduling's own context
 * to compose across the same boundary from the web layer.
 */
export async function PUT(request: NextRequest) {
  const id = requestId(request);
  try {
    const input = tutorZoomDefaultsInputSchema.parse(await request.json());
    const tutorContext = await apiTutorContext(request);
    const profile = await updateTutorZoomDefaults(tutorContext.database, tutorContext.actor, input);

    if (profile.defaultZoomJoinUrl) {
      const schedulingContext = await apiSchedulingContext(request);
      const tutorProfileId = await schedulingContext.database.resolveTutorProfileIdForUser(
        schedulingContext.actor.userId,
      );
      if (tutorProfileId) {
        await applyTutorZoomDefaultsToUpcomingLessons(
          schedulingContext.database,
          tutorProfileId,
          schedulingContext.actor.userId,
          { joinUrl: profile.defaultZoomJoinUrl, passcode: profile.defaultZoomPasscode },
        );
      }
    }

    return NextResponse.json({
      data: {
        defaultZoomJoinUrl: profile.defaultZoomJoinUrl,
        defaultZoomPasscode: profile.defaultZoomPasscode,
      },
      requestId: id,
    });
  } catch (error: unknown) {
    return tutorApiError(error, id);
  }
}
