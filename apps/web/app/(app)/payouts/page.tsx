import { PayoutOverview } from "../../../components/payouts/payout-overview";
import { loadPayoutDashboard } from "./queries";

export default async function PayoutsPage() {
  const dashboard = await loadPayoutDashboard();
  return <PayoutOverview dashboard={dashboard} />;
}
