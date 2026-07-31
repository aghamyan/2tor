import { NextResponse, type NextRequest } from "next/server";

import {
  currentUtcMonth,
  getFinanceEarningLedger,
  getTutorEarningsSummary,
} from "../../../../../../packages/domain/payouts/services";
import { apiPayoutContext } from "../_context";
import { payoutApiError, requestId } from "../_response";

export async function GET(request: NextRequest) {
  const id = requestId(request);
  try {
    const context = await apiPayoutContext(request);
    const fallback = currentUtcMonth();
    const filter = {
      periodStart: request.nextUrl.searchParams.get("periodStart") ?? fallback.periodStart,
      periodEnd: request.nextUrl.searchParams.get("periodEnd") ?? fallback.periodEnd,
    };
    const financeViewer = context.actor.roles.some((role) =>
      ["finance", "administrator", "super_administrator"].includes(role),
    );
    const data = financeViewer
      ? await getFinanceEarningLedger(context.database, context.actor, filter)
      : await getTutorEarningsSummary(context.database, context.actor, filter);
    return NextResponse.json({ data, requestId: id });
  } catch (error: unknown) {
    return payoutApiError(error, id);
  }
}
