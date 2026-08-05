import { NewResourceForm } from "../../../../components/content/new-resource-form";
import { loadNewResourceFormData } from "../queries";

export const dynamic = "force-dynamic";

export default async function NewResourcePage() {
  const { subjects } = await loadNewResourceFormData();
  return <NewResourceForm subjects={subjects} />;
}
