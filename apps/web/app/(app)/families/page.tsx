import { FamilyOverview } from "../../../components/families/family-overview";
import { loadFamilyOverview } from "./queries";

export default async function FamiliesPage() {
  const data = await loadFamilyOverview();
  return <FamilyOverview {...data} />;
}
