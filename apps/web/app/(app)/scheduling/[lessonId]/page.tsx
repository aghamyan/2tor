import { LessonDetailView } from "../../../../components/scheduling/lesson-detail";
import { loadLessonDetailForViewer } from "../queries";

export default async function LessonDetailPage({
  params,
}: {
  params: Promise<{ lessonId: string }>;
}) {
  const { lessonId } = await params;
  const { detail, viewerUserId, isStaff, feedback } = await loadLessonDetailForViewer(lessonId);
  return (
    <LessonDetailView detail={detail} viewerUserId={viewerUserId} isStaff={isStaff} feedback={feedback} />
  );
}
