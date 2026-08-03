import type { Metadata } from "next";
import { DiscussionsOverview } from "../../../components/discussions/discussions-overview";
import { QuestionsPage } from "../../../components/student-workspace/student-pages";
import { currentSession } from "../../../lib/current-session";

export const metadata: Metadata = {
  title: "Learning Questions",
  robots: { index: false, follow: false, nocache: true },
};

export default async function DiscussionsPage() {
  const session = await currentSession();
  return session?.roles.includes("student") ? <QuestionsPage /> : <DiscussionsOverview />;
}
