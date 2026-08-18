import { NextResponse, type NextRequest } from "next/server";
import { recordAssessmentEvidence } from "../../../../../../../../packages/domain/assessments/services";
import type { RecordEvidenceInput } from "../../../../../../../../packages/domain/assessments/schemas";
import { createS3AssessmentEvidenceStorage } from "../../../../../../../../packages/domain/assessments/storage";
import { apiAssessmentContext } from "../../../_context";
import { assessmentApiError, assessmentRequestId } from "../../../_response";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> },
) {
  const requestId = assessmentRequestId(request);
  try {
    const form = await request.formData();
    const file = form.get("file");
    const eventType = form.get("eventType");
    if (!(file instanceof File) || typeof eventType !== "string") {
      throw new Error("An evidence file and its triggering eventType are required.");
    }
    const context = await apiAssessmentContext(request);
    const { attemptId } = await params;
    // recordAssessmentEvidence's Zod schema is what actually validates eventType/mimeType at
    // runtime (see recordEvidenceSchema) — this cast only reshapes the untyped form fields.
    const evidence = await recordAssessmentEvidence(
      context.database,
      createS3AssessmentEvidenceStorage(),
      context.actor,
      attemptId,
      { eventType, mimeType: file.type, sizeBytes: file.size } as RecordEvidenceInput,
      new Uint8Array(await file.arrayBuffer()),
    );
    return NextResponse.json({ data: evidence, requestId }, { status: 201 });
  } catch (error) {
    return assessmentApiError(error, requestId);
  }
}
