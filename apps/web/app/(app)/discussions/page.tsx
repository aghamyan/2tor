import type { Metadata } from "next";
import { DiscussionsOverview } from "../../../components/discussions/discussions-overview";

export const metadata: Metadata = {
  title: "Learning Questions",
  robots: { index: false, follow: false, nocache: true },
};

export default function DiscussionsPage() {
  return <DiscussionsOverview />;
}
