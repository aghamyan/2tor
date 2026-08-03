import { TutorStudents } from "../../../../components/tutors/tutor-students";
import { loadTutorStudents } from "../queries";

export default async function TutorStudentsPage() {
  const students = await loadTutorStudents();
  return <TutorStudents active={students.active} past={students.past} />;
}
