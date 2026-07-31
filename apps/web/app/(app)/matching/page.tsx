import { redirect } from "next/navigation";

import { MatchingQueue } from "../../../components/matching/matching-queue";
import { MatchingError } from "../../../../../packages/domain/matching/errors";
import { listAdminMatchingQueue } from "../../../../../packages/domain/matching/services";
import { currentMatchingContext } from "./context";

async function loadMatchingQueue() {
  try {
    const context = await currentMatchingContext();
    return listAdminMatchingQueue(context.database, context.actor);
  } catch (error: unknown) {
    if (error instanceof MatchingError && error.code === "UNAUTHENTICATED") redirect("/login");
    throw error;
  }
}

export default async function MatchingPage() {
  const requests = await loadMatchingQueue();
  return <MatchingQueue requests={requests} />;
}
