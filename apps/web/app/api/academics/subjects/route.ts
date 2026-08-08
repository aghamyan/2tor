import { NextResponse, type NextRequest } from "next/server";
import { listSubjects } from "../../../../../../packages/domain/academics/services";
import { apiAcademicContext } from "../_context";
import { academicApiError, academicRequestId } from "../_response";

/** Reference data for the "Subject" picker — available to any authenticated actor. */
export async function GET(request: NextRequest) {
  const requestId = academicRequestId(request);
  try {
    const context = await apiAcademicContext(request);
    const subjects = await listSubjects(context.database, context.actor);
    return NextResponse.json({ data: subjects, requestId });
  } catch (error) {
    return academicApiError(error, requestId);
  }
}
