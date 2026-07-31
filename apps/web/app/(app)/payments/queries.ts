import { notFound, redirect } from "next/navigation";

import { PaymentError } from "../../../../../packages/domain/payments/errors";
import {
  getFinancialReportForActor,
  listInvoicesForActor,
  listTransactionsForActor,
} from "../../../../../packages/domain/payments/services";
import { currentPaymentContext } from "./context";

export async function loadPaymentDashboard() {
  try {
    const context = await currentPaymentContext();
    const [invoices, transactions] = await Promise.all([
      listInvoicesForActor(context.database, context.actor, { limit: 50 }),
      listTransactionsForActor(context.database, context.actor, { limit: 50 }),
    ]);
    const canReport =
      context.actor.roles.includes("finance") ||
      context.actor.roles.includes("administrator") ||
      context.actor.roles.includes("super_administrator");
    const to = new Date();
    const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1_000);
    const reports = canReport
      ? await Promise.all(
          (["USD", "AMD"] as const).map((currency) =>
            getFinancialReportForActor(context.database, context.actor, {
              from: from.toISOString(),
              to: to.toISOString(),
              currency,
            }),
          ),
        )
      : [];
    return {
      invoices: invoices.items,
      transactions: transactions.items,
      reports,
      canPay:
        context.actor.roles.includes("parent") ||
        context.actor.roles.includes("administrator") ||
        context.actor.roles.includes("super_administrator"),
      canRefund: canReport,
      canManageDiscounts:
        context.actor.roles.includes("administrator") ||
        context.actor.roles.includes("super_administrator"),
    };
  } catch (error: unknown) {
    if (error instanceof PaymentError && error.code === "UNAUTHENTICATED") redirect("/login");
    if (error instanceof PaymentError && error.code === "FORBIDDEN") notFound();
    throw error;
  }
}
