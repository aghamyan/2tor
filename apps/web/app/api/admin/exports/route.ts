import { NextResponse, type NextRequest } from "next/server";

import { requestBulkExportInputSchema } from "../../../../../../packages/domain/administration/schemas";
import {
  listExports,
  requestBulkExport,
} from "../../../../../../packages/domain/administration/services";
import { authorizeExportRequest } from "../../../(app)/admin/authorization";
import { apiAdministrationContext } from "../_context";
import { administrationApiError, requestId } from "../_response";

export async function GET(request: NextRequest) {
  const id = requestId(request);
  try {
    const context = await apiAdministrationContext(request);
    const items = await listExports(context.database, context.actor);
    return NextResponse.json({ data: items, requestId: id });
  } catch (error: unknown) {
    return administrationApiError(error, id);
  }
}

/** Step 1 of the two-person export flow — see packages/audit/README.md. */
export async function POST(request: NextRequest) {
  const id = requestId(request);
  try {
    const context = await apiAdministrationContext(request);
    authorizeExportRequest(context.actor);
    const input = requestBulkExportInputSchema.parse(await request.json());
    const result = await requestBulkExport(context.database, context.audit, context.actor, input);
    return NextResponse.json({ data: result, requestId: id }, { status: 201 });
  } catch (error: unknown) {
    return administrationApiError(error, id);
  }
}
