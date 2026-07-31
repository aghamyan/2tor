import { DiagnosticReview } from "../../../../../../components/assessments/diagnostic-review";

export default async function AssessmentReviewPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const { attemptId } = await params;
  return <DiagnosticReview attemptId={attemptId} />;
}
