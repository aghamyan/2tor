import { NextResponse, type NextRequest } from "next/server";

import { verificationReviewInputSchema } from "../../../../../../../packages/domain/tutors/schemas";
import { reviewTutorVerification } from "../../../../../../../packages/domain/tutors/services";
import { apiTutorContext } from "../../_context";
import { requestId, tutorApiError } from "../../_response";

/** Staff review endpoint. `reviewTutorVerification()` calls @app/auth and rejects self-approval. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ verificationId: string }> },
) {
  const id = requestId(request);
  try {
    const { verificationId } = await params;
    const context = await apiTutorContext(request);
    const verification = await reviewTutorVerification(
      context.database,
      context.actor,
      verificationId,
      verificationReviewInputSchema.parse(await request.json()),
    );
    return NextResponse.json({ data: verification, requestId: id });
  } catch (error: unknown) {
    return tutorApiError(error, id);
  }
}
