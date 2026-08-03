import { StudentOverviewPage } from "../../../../../components/student-workspace/student-pages";
import { loadStudentDashboardSummary } from "../../_lib/summaries";
import { loadStudentDashboardViewer } from "../../_lib/viewer";

export const dynamic = "force-dynamic";

export default async function StudentDashboardPage() {
  const [viewer, summary] = await Promise.all([
    loadStudentDashboardViewer(),
    loadStudentDashboardSummary(),
  ]);
  return (
    <StudentOverviewPage
      name={viewer.profile.preferredName}
      nextLesson={summary.nextLesson}
      nextLessonJoinUrl={summary.nextLessonJoinUrl}
      weekLessonCount={summary.weekLessonCount}
    />
  );
}
