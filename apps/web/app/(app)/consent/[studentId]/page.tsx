import { StudentConsentScreen } from "../../../../components/consent/student-consent-screen";
import { loadConsentStudent } from "../queries";

export default async function StudentConsentPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;
  const detail = await loadConsentStudent(studentId);
  return <StudentConsentScreen detail={detail} />;
}
