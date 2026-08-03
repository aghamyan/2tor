import { NextResponse, type NextRequest } from "next/server";

import { tutorCapabilitiesInputSchema } from "../../../../../../../packages/domain/tutors/schemas";
import { updateTutorCapabilities } from "../../../../../../../packages/domain/tutors/services";
import { apiTutorContext } from "../../_context";
import { requestId, tutorApiError } from "../../_response";

/** Subjects, grade ranges, and languages save together — `updateTutorCapabilities()` replaces all
 * three in one transaction, so a partial payload here would silently wipe the other two arrays. */
export async function GET(request: NextRequest) {
  const id = requestId(request);
  try {
    const context = await apiTutorContext(request);
    const profile = await context.database.findTutorProfileByUserId(context.actor.userId);
    if (!profile) {
      return NextResponse.json({
        data: { subjects: [], gradeRanges: [], languages: [] },
        requestId: id,
      });
    }
    const [subjects, gradeRanges, languages] = await Promise.all([
      context.database.listSubjects(profile.id),
      context.database.listGradeRanges(profile.id),
      context.database.listLanguages(profile.id),
    ]);
    return NextResponse.json({ data: { subjects, gradeRanges, languages }, requestId: id });
  } catch (error: unknown) {
    return tutorApiError(error, id);
  }
}

export async function PUT(request: NextRequest) {
  const id = requestId(request);
  try {
    const context = await apiTutorContext(request);
    const input = tutorCapabilitiesInputSchema.parse(await request.json());
    await updateTutorCapabilities(context.database, context.actor, input);
    return NextResponse.json({ data: { saved: true }, requestId: id });
  } catch (error: unknown) {
    return tutorApiError(error, id);
  }
}
