import { StudentProfileManager } from "../../../../components/families/student-profile-manager";
import { loadFamilyStudent } from "../queries";

export default async function StudentFamilyPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;
  const student = await loadFamilyStudent(studentId);
  return <StudentProfileManager student={student} />;
}
