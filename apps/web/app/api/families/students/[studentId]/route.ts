import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { studentProfileInputSchema } from "../../../../../../../packages/domain/families/schemas";
import {
  correctStudentInfo,
  getFamilyStudent,
} from "../../../../../../../packages/domain/families/services";
import { authorizeStudentRelationship } from "../../../../(app)/families/authorization";
import { apiFamilyContext } from "../../_context";
import { familyApiError, requestId } from "../../_response";

const correctionSchema = z
  .object({
    profile: studentProfileInputSchema,
    reason: z.string().trim().min(3).max(300),
  })
  .strict();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ studentId: string }> },
) {
  const id = requestId(request);
  try {
    const { studentId } = await params;
    const context = await apiFamilyContext(request);
    await authorizeStudentRelationship(
      context.database,
      context.actor,
      studentId,
      "student.view_profile",
    );
    const student = await getFamilyStudent(context.database, context.actor, studentId);
    return NextResponse.json({ data: student, requestId: id });
  } catch (error: unknown) {
    return familyApiError(error, id);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ studentId: string }> },
) {
  const id = requestId(request);
  try {
    const { studentId } = await params;
    const context = await apiFamilyContext(request);
    await authorizeStudentRelationship(
      context.database,
      context.actor,
      studentId,
      "student.manage_profile",
    );
    const input = correctionSchema.parse(await request.json());
    const student = await correctStudentInfo(
      context.database,
      context.actor,
      studentId,
      input.profile,
      input.reason,
    );
    return NextResponse.json({ data: student, requestId: id });
  } catch (error: unknown) {
    return familyApiError(error, id);
  }
}
