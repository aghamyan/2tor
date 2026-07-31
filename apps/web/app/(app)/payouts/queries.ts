import { redirect } from "next/navigation";

import { PayoutError } from "../../../../../packages/domain/payouts/errors";
import type { PayoutDashboard } from "../../../../../packages/domain/payouts/models";
import { getPayoutDashboard } from "../../../../../packages/domain/payouts/services";
import { currentPayoutContext } from "./context";

export async function loadPayoutDashboard(): Promise<PayoutDashboard> {
  try {
    const context = await currentPayoutContext();
    return await getPayoutDashboard(context.database, context.actor);
  } catch (error: unknown) {
    if (error instanceof PayoutError && error.code === "UNAUTHENTICATED") redirect("/login");
    throw error;
  }
}
