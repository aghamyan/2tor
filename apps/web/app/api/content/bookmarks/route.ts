import { NextResponse, type NextRequest } from "next/server";
import { bookmarkSchema } from "../../../../../../packages/domain/content/schemas";
import {
  bookmarkResource,
  removeBookmark,
} from "../../../../../../packages/domain/content/services";
import { apiContentContext } from "../_context";
import { contentApiError, contentRequestId } from "../_response";
export async function POST(request: NextRequest) {
  const requestId = contentRequestId(request);
  try {
    const context = await apiContentContext(request);
    const { resourceId } = bookmarkSchema.parse(await request.json());
    await bookmarkResource(context.database, context.actor, resourceId);
    return NextResponse.json(
      { data: { resourceId, bookmarked: true }, requestId },
      { status: 201 },
    );
  } catch (error) {
    return contentApiError(error, requestId);
  }
}
export async function DELETE(request: NextRequest) {
  const requestId = contentRequestId(request);
  try {
    const context = await apiContentContext(request);
    const { resourceId } = bookmarkSchema.parse(await request.json());
    await removeBookmark(context.database, context.actor, resourceId);
    return NextResponse.json({ data: { resourceId, bookmarked: false }, requestId });
  } catch (error) {
    return contentApiError(error, requestId);
  }
}
