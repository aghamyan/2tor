import { NextResponse, type NextRequest } from "next/server";

import { createDb } from "@app/db";
import { createDrizzleTutorDatabase } from "../../../../../../../packages/domain/tutors/drizzle-database";
import { availabilityQuerySchema } from "../../../../../../../packages/domain/tutors/schemas";
import { tutorAvailabilityForScheduling } from "../../../../../../../packages/domain/tutors/services";
import { requestId, tutorApiError } from "../../_response";

/** D5's read-only availability endpoint. It returns UTC half-open windows, never reservations. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tutorId: string }> },
) {
  const id = requestId(request);
  try {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) throw new Error("DATABASE_URL is required for tutor availability.");
    const { tutorId } = await params;
    const range = availabilityQuerySchema.parse({
      startAt: request.nextUrl.searchParams.get("startAt"),
      endAt: request.nextUrl.searchParams.get("endAt"),
    });
    const windows = await tutorAvailabilityForScheduling(
      createDrizzleTutorDatabase(createDb(databaseUrl)),
      tutorId,
      range,
    );
    return NextResponse.json({ data: { tutorProfileId: tutorId, windows }, requestId: id });
  } catch (error: unknown) {
    return tutorApiError(error, id);
  }
}
