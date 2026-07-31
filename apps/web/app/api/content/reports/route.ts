import { NextResponse, type NextRequest } from "next/server";
import { reportContentSchema } from "../../../../../../packages/domain/content/schemas";
import { reportContent } from "../../../../../../packages/domain/content/services";
import { apiContentContext } from "../_context";
import { contentApiError, contentRequestId } from "../_response";
export async function POST(request: NextRequest) {
  const requestId = contentRequestId(request);
  try {
    const context = await apiContentContext(request);
    const values = reportContentSchema.parse(await request.json());
    const report = await reportContent(
      context.database,
      context.actor,
      values.resourceId,
      values.reason,
    );
    return NextResponse.json({ data: report, requestId }, { status: 201 });
  } catch (error) {
    return contentApiError(error, requestId);
  }
}
