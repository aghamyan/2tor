import { NextResponse, type NextRequest } from "next/server";
import { incidentActionSchema } from "../../../../../../../../packages/domain/support/schemas";
import { recordIncidentAction } from "../../../../../../../../packages/domain/support/services";
import { apiSupportContext } from "../../../_context";
import { supportApiError, supportRequestId } from "../../../_response";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ incidentId: string }> },
) {
  const requestId = supportRequestId(request);
  try {
    const context = await apiSupportContext(request);
    const { incidentId } = await params;
    const data = await recordIncidentAction(
      context.database,
      context.actor,
      incidentId,
      incidentActionSchema.parse(await request.json()),
    );
    return NextResponse.json({ data, requestId }, { status: 201 });
  } catch (error) {
    return supportApiError(error, requestId);
  }
}
