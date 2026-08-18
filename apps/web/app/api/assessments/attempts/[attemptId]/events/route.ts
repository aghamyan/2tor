import { notify } from "@app/notifications/dispatch";
import { NextResponse, type NextRequest } from "next/server";
import type { AssessmentNotifier } from "../../../../../../../../packages/domain/assessments/models";
import { recordAssessmentSignals } from "../../../../../../../../packages/domain/assessments/services";
import type { IntegritySignalBatchInput } from "../../../../../../../../packages/domain/assessments/schemas";
import { apiAssessmentContext } from "../../../_context";
import { assessmentApiError, assessmentRequestId } from "../../../_response";

const notifier: AssessmentNotifier = { notify };

/** Accepts a single signal (`{ eventType, ... }`) or a batch (`{ signals: [...] }`) — the client's
 * proctoring guards coalesce state-transition signals and send them together. The service's Zod
 * schema is what actually validates the shape at runtime; this only reshapes before that parse. */
function batchBody(payload: unknown): IntegritySignalBatchInput {
  if (payload !== null && typeof payload === "object" && "signals" in payload) {
    return payload as IntegritySignalBatchInput;
  }
  return { signals: [payload] } as IntegritySignalBatchInput;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> },
) {
  const requestId = assessmentRequestId(request);
  try {
    const context = await apiAssessmentContext(request);
    const { attemptId } = await params;
    const { events, attemptStatus } = await recordAssessmentSignals(
      context.database,
      context.actor,
      attemptId,
      batchBody(await request.json()),
      notifier,
    );
    return NextResponse.json({ data: events, attemptStatus, requestId }, { status: 201 });
  } catch (error) {
    return assessmentApiError(error, requestId);
  }
}
