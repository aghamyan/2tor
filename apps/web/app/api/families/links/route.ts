import { NextResponse, type NextRequest } from "next/server";

import {
  linkStudentInputSchema,
  unlinkStudentInputSchema,
} from "../../../../../../packages/domain/families/schemas";
import { linkStudent, unlinkStudent } from "../../../../../../packages/domain/families/services";
import { authorizeStudentRelationship } from "../../../(app)/families/authorization";
import { apiFamilyContext } from "../_context";
import { familyApiError, requestId } from "../_response";

export async function POST(request: NextRequest) {
  const id = requestId(request);
  try {
    const context = await apiFamilyContext(request);
    const input = linkStudentInputSchema.parse(await request.json());
    await authorizeStudentRelationship(
      context.database,
      context.actor,
      input.studentProfileId,
      "student.manage_profile",
    );
    await linkStudent(context.database, context.actor, input);
    return NextResponse.json({ data: { linked: true }, requestId: id }, { status: 201 });
  } catch (error: unknown) {
    return familyApiError(error, id);
  }
}

export async function DELETE(request: NextRequest) {
  const id = requestId(request);
  try {
    const context = await apiFamilyContext(request);
    const input = unlinkStudentInputSchema.parse(await request.json());
    await authorizeStudentRelationship(
      context.database,
      context.actor,
      input.studentProfileId,
      "student.manage_profile",
    );
    await unlinkStudent(context.database, context.actor, input);
    return NextResponse.json({ data: { unlinked: true }, requestId: id });
  } catch (error: unknown) {
    return familyApiError(error, id);
  }
}
