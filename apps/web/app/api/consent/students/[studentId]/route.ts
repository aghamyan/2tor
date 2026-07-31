import { NextResponse, type NextRequest } from "next/server";

import { hasValidConsent } from "../../../../../../../packages/domain/consent/services";
import { getFamilyStudent } from "../../../../../../../packages/domain/families/services";
import { authorizeConsentAction } from "../../../../(app)/consent/authorization";
import { apiConsentContext } from "../../_context";
import { consentApiError, requestId } from "../../_response";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ studentId: string }> },
) {
  const id = requestId(request);
  try {
    const { studentId } = await params;
    const context = await apiConsentContext(request);
    await authorizeConsentAction(context.familyDatabase, context.actor, studentId);
    const student = await getFamilyStudent(context.familyDatabase, context.actor, studentId);
    const [valid, records] = await Promise.all([
      hasValidConsent(context.database, studentId),
      context.database.listConsentRecords(studentId),
    ]);
    return NextResponse.json({
      data: {
        studentProfileId: studentId,
        preferredName: student.preferredName,
        isAdultLearner: student.isAdultLearner,
        status: student.status,
        hasValidConsent: valid,
        latestConsent: records[0] ?? null,
      },
      requestId: id,
    });
  } catch (error: unknown) {
    return consentApiError(error, id);
  }
}
