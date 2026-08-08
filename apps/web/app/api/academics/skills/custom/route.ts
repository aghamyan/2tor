import { NextResponse, type NextRequest } from "next/server";
import { createCustomSkillSchema } from "../../../../../../../packages/domain/academics/schemas";
import { createCustomSkill } from "../../../../../../../packages/domain/academics/services";
import { apiAcademicContext } from "../../_context";
import { academicApiError, academicRequestId } from "../../_response";

/**
 * Tutor-only escape hatch for a topic the seeded curriculum doesn't cover. Not tied to one
 * student, so there is no `authorizeAcademicRecord` relationship check here — `createCustomSkill`
 * itself requires a tutor or staff role.
 */
export async function POST(request: NextRequest) {
  const requestId = academicRequestId(request);
  try {
    const context = await apiAcademicContext(request);
    const input = createCustomSkillSchema.parse(await request.json());
    const skill = await createCustomSkill(context.database, context.actor, input);
    return NextResponse.json({ data: skill, requestId }, { status: 201 });
  } catch (error) {
    return academicApiError(error, requestId);
  }
}
