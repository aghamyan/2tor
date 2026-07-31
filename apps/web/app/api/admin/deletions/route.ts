import { NextResponse, type NextRequest } from "next/server";

import { requestMassDeletionInputSchema } from "../../../../../../packages/domain/administration/schemas";
import {
  listDeletionJobs,
  requestMassDeletion,
} from "../../../../../../packages/domain/administration/services";
import { authorizeMassDeletion } from "../../../(app)/admin/authorization";
import { apiAdministrationContext } from "../_context";
import { administrationApiError, requestId } from "../_response";

export async function GET(request: NextRequest) {
  const id = requestId(request);
  try {
    const context = await apiAdministrationContext(request);
    const items = await listDeletionJobs(context.database, context.actor);
    return NextResponse.json({ data: items, requestId: id });
  } catch (error: unknown) {
    return administrationApiError(error, id);
  }
}

export async function POST(request: NextRequest) {
  const id = requestId(request);
  try {
    const context = await apiAdministrationContext(request);
    authorizeMassDeletion(context.actor);
    const input = requestMassDeletionInputSchema.parse(await request.json());
    const result = await requestMassDeletion(context.database, context.audit, context.actor, input);
    return NextResponse.json({ data: result, requestId: id }, { status: 201 });
  } catch (error: unknown) {
    return administrationApiError(error, id);
  }
}
