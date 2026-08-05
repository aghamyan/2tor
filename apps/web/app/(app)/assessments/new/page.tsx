import { NewAssessmentForm } from "../../../../components/assessments/new-assessment-form";
import { loadNewAssessmentFormData } from "../queries";

export const dynamic = "force-dynamic";

export default async function NewAssessmentPage() {
  const { subjects, students } = await loadNewAssessmentFormData();
  return <NewAssessmentForm subjects={subjects} students={students} />;
}
