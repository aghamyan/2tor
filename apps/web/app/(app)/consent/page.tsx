import { ConsentOverview } from "../../../components/consent/consent-overview";
import { loadConsentOverview } from "./queries";

export default async function ConsentPage() {
  const { items } = await loadConsentOverview();
  return <ConsentOverview items={items} />;
}
