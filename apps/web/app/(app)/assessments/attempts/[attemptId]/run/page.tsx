import { ExamRun } from "../../../../../../components/assessments/exam-run";

export default async function AssessmentRunPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const { attemptId } = await params;
  return <ExamRun attemptId={attemptId} />;
}
