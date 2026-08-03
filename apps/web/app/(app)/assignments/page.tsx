import { AssignmentsOverview } from "../../../components/assignments/assignments-overview";
import { StudentHomeworkPage } from "../../../components/student-workspace/student-pages";
import { loadAssignmentList } from "./queries";

export const dynamic = "force-dynamic";

export default async function AssignmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; cursor?: string }>;
}) {
  const { status, cursor } = await searchParams;
  const data = await loadAssignmentList({ status, cursor });
  return data.isStudentSelf ? (
    <StudentHomeworkPage data={data} />
  ) : (
    <AssignmentsOverview currentStatus={status} data={data} />
  );
}
