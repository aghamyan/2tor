import { NextResponse, type NextRequest } from "next/server";
import { createResourceSchema } from "../../../../../../packages/domain/content/schemas";
import { createResource, listResources } from "../../../../../../packages/domain/content/services";
import { apiContentContext } from "../_context";
import { contentApiError, contentRequestId } from "../_response";
export async function GET(request: NextRequest) {
  const requestId = contentRequestId(request);
  try {
    const context = await apiContentContext(request);
    const tag = request.nextUrl.searchParams.get("tag") ?? undefined;
    const subjectId = request.nextUrl.searchParams.get("subjectId") ?? undefined;
    return NextResponse.json({
      data: await listResources(context.database, context.actor, { tag, subjectId }),
      requestId,
    });
  } catch (error) {
    return contentApiError(error, requestId);
  }
}
export async function POST(request: NextRequest) {
  const requestId = contentRequestId(request);
  try {
    const context = await apiContentContext(request);
    const resource = await createResource(
      context.database,
      context.actor,
      createResourceSchema.parse(await request.json()),
    );
    return NextResponse.json({ data: resource, requestId }, { status: 201 });
  } catch (error) {
    return contentApiError(error, requestId);
  }
}
