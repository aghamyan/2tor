import { NextResponse, type NextRequest } from "next/server";

import { decideBulkExportInputSchema } from "../../../../../../../../packages/domain/administration/schemas";
import { decideBulkExport } from "../../../../../../../../packages/domain/administration/services";
import { authorizeExportDecision } from "../../../../../(app)/admin/authorization";
import { apiAdministrationContext } from "../../../_context";
import { administrationApiError, requestId } from "../../../_response";

/**
 * Step 2 of the two-person export flow. `decideBulkExport` (packages/domain/administration/services.ts)
 * rejects when the caller is the same actor who requested it — see packages/audit/README.md.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ exportId: string }> },
) {
  const id = requestId(request);
  try {
    const { exportId } = await params;
    const context = await apiAdministrationContext(request);
    authorizeExportDecision(context.actor);
    const input = decideBulkExportInputSchema.parse({ ...(await request.json()), exportId });
    const result = await decideBulkExport(context.database, context.audit, context.actor, input);
    return NextResponse.json({ data: result, requestId: id });
  } catch (error: unknown) {
    return administrationApiError(error, id);
  }
}
