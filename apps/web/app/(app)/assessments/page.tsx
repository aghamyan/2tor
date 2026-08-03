import { AssessmentsOverview as LegacyAssessmentsOverview } from "../../../components/assessments/assessments-overview";
import { AssessmentsPage as StudentAssessmentsPage } from "../../../components/student-workspace/student-pages";
import { currentSession } from "../../../lib/current-session";

export default async function AssessmentsPage() {
  const session = await currentSession();
  return session?.roles.includes("student") ? <StudentAssessmentsPage /> : <LegacyAssessmentsOverview />;
}
