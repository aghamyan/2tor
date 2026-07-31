import type { NextRequest } from "next/server";

import { exportPayoutBatchCsv } from "../../../../../../../../packages/domain/payouts/services";
import { apiPayoutContext } from "../../../_context";
import { payoutApiError, requestId } from "../../../_response";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ batchId: string }> },
) {
  const id = requestId(request);
  try {
    const context = await apiPayoutContext(request);
    const { batchId } = await params;
    const file = await exportPayoutBatchCsv(context.database, context.actor, batchId);
    return new Response(file.csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${file.filename}"`,
        "x-request-id": id,
      },
    });
  } catch (error: unknown) {
    return payoutApiError(error, id);
  }
}
