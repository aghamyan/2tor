import { NextResponse, type NextRequest } from "next/server";
import { getParentVisibleFeedback } from "../../../../../../../packages/domain/academics/services";
import { AcademicError } from "../../../../../../../packages/domain/academics/errors";
import { authorizeAcademicRecord } from "../../../../(app)/academics/authorization";
import { apiAcademicContext } from "../../_context";
import { academicApiError, academicRequestId } from "../../_response";
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ feedbackId: string }> },
) {
  const requestId = academicRequestId(request);
  try {
    const context = await apiAcademicContext(request);
    const { feedbackId } = await params;
    const record = await context.database.getFeedback(feedbackId);
    if (!record)
      throw new AcademicError("FEEDBACK_NOT_FOUND", "Lesson feedback was not found.", 404);
    await authorizeAcademicRecord(
      context.database,
      context.actor,
      record.studentProfileId,
      "academic.view_record",
    );
    const feedback = await getParentVisibleFeedback(context.database, context.actor, feedbackId);
    return NextResponse.json({ data: feedback, requestId });
  } catch (error) {
    return academicApiError(error, requestId);
  }
}
