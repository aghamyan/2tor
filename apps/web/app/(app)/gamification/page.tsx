import { redirect } from "next/navigation";

/** The mastery map and rewards now live together at /academics (single combined page). */
export default function GamificationPage() {
  redirect("/academics");
}
