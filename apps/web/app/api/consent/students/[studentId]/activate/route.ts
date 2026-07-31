import { NextResponse, type NextRequest } from "next/server";

// See `apps/web/app/(app)/consent/actions.ts` for why this imports `./dispatch` directly rather
// than the `@app/notifications` barrel.
import { notify } from "@app/notifications/dispatch";

import type { ConsentNotifier } from "../../../../../../../../packages/domain/consent/models";
import { activateStudent } from "../../../../../../../../packages/domain/consent/services";
import { authorizeConsentAction } from "../../../../../(app)/consent/authorization";
import { apiConsentContext } from "../../../_context";
import { consentApiError, requestId } from "../../../_response";

/** See `packages/domain/consent/README.md`, "Notification wiring". */
const notifier: ConsentNotifier = { notify };

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ studentId: string }> },
) {
  const id = requestId(request);
  try {
    const { studentId } = await params;
    const context = await apiConsentContext(request);
    await authorizeConsentAction(context.familyDatabase, context.actor, studentId);
    const student = await activateStudent(
      context.database,
      context.familyDatabase,
      notifier,
      context.actor,
      studentId,
    );
    return NextResponse.json({ data: student, requestId: id });
  } catch (error: unknown) {
    return consentApiError(error, id);
  }
}
