import { notify } from "@app/notifications/dispatch";
import { NextResponse, type NextRequest } from "next/server";
import type { AssessmentNotifier } from "../../../../../../../../packages/domain/assessments/models";
import { submitAssessmentAttempt } from "../../../../../../../../packages/domain/assessments/services";
import { apiAssessmentContext } from "../../../_context";
import { assessmentApiError, assessmentRequestId } from "../../../_response";

const notifier: AssessmentNotifier = { notify };

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> },
) {
  const requestId = assessmentRequestId(request);
  try {
    const context = await apiAssessmentContext(request);
    const { attemptId } = await params;
    const attempt = await submitAssessmentAttempt(
      context.database,
      context.actor,
      attemptId,
      await request.json(),
      notifier,
    );
    return NextResponse.json({ data: attempt, requestId });
  } catch (error) {
    return assessmentApiError(error, requestId);
  }
}
