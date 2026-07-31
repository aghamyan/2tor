import { NextResponse, type NextRequest } from "next/server";

import { createStudentInputSchema } from "../../../../../../packages/domain/families/schemas";
import {
  createStudentUnderParent,
  listFamilyStudents,
} from "../../../../../../packages/domain/families/services";
import { authorizeParentWorkspace } from "../../../(app)/families/authorization";
import { apiFamilyContext } from "../_context";
import { familyApiError, requestId } from "../_response";

export async function GET(request: NextRequest) {
  const id = requestId(request);
  try {
    const context = await apiFamilyContext(request);
    authorizeParentWorkspace(context.actor);
    const cursor = request.nextUrl.searchParams.get("cursor");
    const limitValue = Number(request.nextUrl.searchParams.get("limit") ?? 20);
    const result = await listFamilyStudents(context.database, context.actor, {
      cursor,
      limit: limitValue,
    });
    return NextResponse.json({ data: result, requestId: id });
  } catch (error: unknown) {
    return familyApiError(error, id);
  }
}

export async function POST(request: NextRequest) {
  const id = requestId(request);
  try {
    const context = await apiFamilyContext(request);
    authorizeParentWorkspace(context.actor);
    const input = createStudentInputSchema.parse(await request.json());
    const student = await createStudentUnderParent(context.database, context.actor, input);
    return NextResponse.json({ data: student, requestId: id }, { status: 201 });
  } catch (error: unknown) {
    return familyApiError(error, id);
  }
}
