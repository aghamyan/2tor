import { ScheduleOverview } from "../../../components/scheduling/schedule-overview";
import { loadUpcomingLessons } from "./queries";

export default async function SchedulingPage() {
  const lessons = await loadUpcomingLessons();
  return <ScheduleOverview lessons={lessons} />;
}
