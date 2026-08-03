import { NewLessonForm } from "../../../../components/scheduling/new-lesson-form";
import { loadSchedulableOptions } from "../queries";

export default async function NewLessonPage() {
  const { assignments, subjects } = await loadSchedulableOptions();
  return <NewLessonForm assignments={assignments} subjects={subjects} />;
}
