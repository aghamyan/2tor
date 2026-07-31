import { NextResponse, type NextRequest } from "next/server";
import { assignResourceSchema } from "../../../../../../packages/domain/content/schemas";
import { assignResource } from "../../../../../../packages/domain/content/services";
import { apiContentContext } from "../_context";
import { contentApiError, contentRequestId } from "../_response";
export async function POST(request: NextRequest) {
  const requestId = contentRequestId(request);
  try {
    const context = await apiContentContext(request);
    await assignResource(
      context.database,
      context.actor,
      assignResourceSchema.parse(await request.json()),
    );
    return NextResponse.json({ data: { assigned: true }, requestId }, { status: 201 });
  } catch (error) {
    return contentApiError(error, requestId);
  }
}
