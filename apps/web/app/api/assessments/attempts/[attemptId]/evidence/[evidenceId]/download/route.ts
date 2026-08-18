import { NextResponse, type NextRequest } from "next/server";
import { AssessmentError } from "../../../../../../../../../../packages/domain/assessments/errors";
import { getAssessmentEvidenceForActor } from "../../../../../../../../../../packages/domain/assessments/services";
import {
  createS3AssessmentEvidenceStorage,
  verifyAssessmentEvidenceSignedUrl,
} from "../../../../../../../../../../packages/domain/assessments/storage";
import { apiAssessmentContext } from "../../../../../_context";
import { assessmentApiError, assessmentRequestId } from "../../../../../_response";

/** Rechecks session, signed URL, and tutor/staff relationship before streaming private storage. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ attemptId: string; evidenceId: string }> },
) {
  const requestId = assessmentRequestId(request);
  try {
    const context = await apiAssessmentContext(request);
    const { attemptId, evidenceId } = await params;
    const token = request.nextUrl.searchParams.get("token");
    if (
      !token ||
      !verifyAssessmentEvidenceSignedUrl(token, attemptId, evidenceId, context.actor.userId)
    ) {
      throw new AssessmentError("FORBIDDEN", "The download URL is invalid or expired.", 403);
    }
    const evidence = await getAssessmentEvidenceForActor(
      context.database,
      context.actor,
      attemptId,
      evidenceId,
    );
    const object = await createS3AssessmentEvidenceStorage().getPrivate(evidence.fileKey);
    return new NextResponse(object.body, {
      headers: {
        "Content-Type": object.contentType ?? evidence.mimeType,
        "Content-Disposition": "inline",
        "Cache-Control": "private, max-age=0, no-store",
      },
    });
  } catch (error) {
    return assessmentApiError(error, requestId);
  }
}
