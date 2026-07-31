import { NextResponse, type NextRequest } from "next/server";
import { lessonFeedbackSchema } from "../../../../../../packages/domain/academics/schemas";
import { writeLessonFeedback } from "../../../../../../packages/domain/academics/services";
import { authorizeAcademicRecord } from "../../../(app)/academics/authorization";
import { apiAcademicContext } from "../_context";
import { academicApiError, academicRequestId } from "../_response";
export async function POST(request: NextRequest) {
  const requestId = academicRequestId(request);
  try {
    const context = await apiAcademicContext(request);
    const input = lessonFeedbackSchema.parse(await request.json());
    await authorizeAcademicRecord(
      context.database,
      context.actor,
      input.studentProfileId,
      "academic.edit_learning_plan",
    );
    const feedback = await writeLessonFeedback(context.database, context.actor, input);
    return NextResponse.json({ data: feedback, requestId }, { status: 201 });
  } catch (error) {
    return academicApiError(error, requestId);
  }
}
