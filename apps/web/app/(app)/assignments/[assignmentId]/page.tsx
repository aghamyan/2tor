import { AssignmentDetail } from "../../../../components/assignments/assignment-detail";
import { loadAssignmentDetail } from "../queries";

export const dynamic = "force-dynamic";

export default async function AssignmentDetailPage({
  params,
}: {
  params: Promise<{ assignmentId: string }>;
}) {
  const { assignmentId } = await params;
  const data = await loadAssignmentDetail(assignmentId);
  return <AssignmentDetail data={data} />;
}
