import { NextResponse, type NextRequest } from "next/server";

import { queryAdminAuditLog } from "../../../../../../packages/domain/administration/services";
import { authorizeAuditView } from "../../../(app)/admin/authorization";
import { apiAdministrationContext } from "../_context";
import { administrationApiError, requestId } from "../_response";

/** Cursor-paginated per docs/CONVENTIONS.md — pass `?cursor=<nextCursor>` back for the next page. */
export async function GET(request: NextRequest) {
  const id = requestId(request);
  try {
    const context = await apiAdministrationContext(request);
    authorizeAuditView(context.actor);
    const { searchParams } = new URL(request.url);
    const page = await queryAdminAuditLog(context.audit, context.actor, {
      actorUserId: searchParams.get("actorUserId") ?? undefined,
      action: searchParams.get("action") ?? undefined,
      resourceType: searchParams.get("resourceType") ?? undefined,
      resourceId: searchParams.get("resourceId") ?? undefined,
      cursor: searchParams.get("cursor") ?? undefined,
      limit: searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined,
    });
    return NextResponse.json({ data: page, requestId: id });
  } catch (error: unknown) {
    return administrationApiError(error, id);
  }
}
