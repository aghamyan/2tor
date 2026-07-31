import { NextResponse, type NextRequest } from "next/server";

// See `apps/web/app/(app)/consent/actions.ts` for why this imports `./dispatch` directly rather
// than the `@app/notifications` barrel.
import { notify } from "@app/notifications/dispatch";

import type { ConsentNotifier } from "../../../../../../../../packages/domain/consent/models";
import { recordConsentInputSchema } from "../../../../../../../../packages/domain/consent/schemas";
import { recordConsent } from "../../../../../../../../packages/domain/consent/services";
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
    const body: unknown = await request.json();
    const input = recordConsentInputSchema.parse({
      ...(typeof body === "object" && body !== null ? body : {}),
      studentProfileId: studentId,
    });
    const record = await recordConsent(
      context.database,
      context.familyDatabase,
      notifier,
      context.actor,
      input,
    );
    return NextResponse.json({ data: record, requestId: id }, { status: 201 });
  } catch (error: unknown) {
    return consentApiError(error, id);
  }
}
