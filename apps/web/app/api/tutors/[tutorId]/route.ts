import { NextResponse, type NextRequest } from "next/server";

import { getPublicTutorProfile } from "../../../../../../packages/domain/tutors/services";
import { createDrizzleTutorDatabase } from "../../../../../../packages/domain/tutors/drizzle-database";
import { createDb } from "@app/db";
import { requestId, tutorApiError } from "../_response";

/** Public projection only: never load documents, verification, training, evaluation, or suspension data here. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tutorId: string }> },
) {
  const id = requestId(request);
  try {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) throw new Error("DATABASE_URL is required for public tutor profiles.");
    const { tutorId } = await params;
    const profile = await getPublicTutorProfile(
      createDrizzleTutorDatabase(createDb(databaseUrl)),
      tutorId,
    );
    return NextResponse.json({ data: profile, requestId: id });
  } catch (error: unknown) {
    return tutorApiError(error, id);
  }
}
