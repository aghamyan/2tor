import { AssessmentEntry } from "../../../../components/assessments/assessment-entry";

export default async function AssessmentPage({
  params,
}: {
  params: Promise<{ assessmentId: string }>;
}) {
  const { assessmentId } = await params;
  return <AssessmentEntry assessmentId={assessmentId} />;
}
