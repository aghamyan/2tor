import { AssessmentAttempts } from "../../../../components/assessments/assessment-attempts";
import { AssessmentEntry } from "../../../../components/assessments/assessment-entry";
import { loadAssessmentDetailPageData } from "../queries";

export default async function AssessmentPage({
  params,
}: {
  params: Promise<{ assessmentId: string }>;
}) {
  const { assessmentId } = await params;
  const data = await loadAssessmentDetailPageData();
  return data.isReviewer ? (
    <AssessmentAttempts assessmentId={assessmentId} />
  ) : (
    <AssessmentEntry assessmentId={assessmentId} />
  );
}
