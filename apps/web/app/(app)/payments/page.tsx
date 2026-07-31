import { PaymentsOverview } from "../../../components/payments/payments-overview";
import { loadPaymentDashboard } from "./queries";

export default async function PaymentsPage() {
  const dashboard = await loadPaymentDashboard();
  return (
    <PaymentsOverview
      {...dashboard}
      stripePublishableKey={process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? null}
    />
  );
}
