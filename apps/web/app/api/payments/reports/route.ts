import { NextResponse, type NextRequest } from "next/server";

import { getFinancialReportForActor } from "../../../../../../packages/domain/payments/services";
import { apiPaymentContext } from "../_context";
import { paymentApiError, paymentRequestId } from "../_response";

export async function GET(request: NextRequest) {
  const requestId = paymentRequestId(request);
  try {
    const context = await apiPaymentContext(request);
    const report = await getFinancialReportForActor(context.database, context.actor, {
      from: request.nextUrl.searchParams.get("from") ?? "",
      to: request.nextUrl.searchParams.get("to") ?? "",
      currency: request.nextUrl.searchParams.get("currency") as "USD" | "AMD",
    });
    return NextResponse.json({ data: report, requestId });
  } catch (error: unknown) {
    return paymentApiError(error, requestId);
  }
}
