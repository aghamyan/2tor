import { AssessmentsOverview as LegacyAssessmentsOverview } from "../../../components/assessments/assessments-overview";
import { AssessmentsPage as StudentAssessmentsPage } from "../../../components/student-workspace/student-pages";
import { loadAssessmentsPageData } from "./queries";

export const dynamic = "force-dynamic";

export default async function AssessmentsPage() {
  const data = await loadAssessmentsPageData();
  return data.isStudent ? (
    <StudentAssessmentsPage assessments={data.assessments} />
  ) : (
    <LegacyAssessmentsOverview canCreate={data.canCreate} />
  );
}
