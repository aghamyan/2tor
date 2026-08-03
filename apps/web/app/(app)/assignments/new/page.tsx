import { NewAssignmentForm } from "../../../../components/assignments/new-assignment-form";
import { loadNewAssignmentFormData } from "../queries";

export const dynamic = "force-dynamic";

export default async function NewAssignmentPage() {
  const { students } = await loadNewAssignmentFormData();
  return <NewAssignmentForm students={students} />;
}
