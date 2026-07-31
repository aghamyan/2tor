import { GamificationOverview } from "../../../components/gamification/gamification-overview";

/** Live points data is loaded through the relationship-authorized overview endpoint. */
export default function GamificationPage() {
  return <GamificationOverview competitionEnabled={false} />;
}
