import { requireActor } from "./capabilities";
import type { DiscussionActor, DiscussionDatabase, DiscussionFeedPage } from "./models";
import { discussionFeedFilterSchema, type DiscussionFeedFilterInput } from "./schemas";

/**
 * Server-side, cursor-paginated, role-aware feed query. Visibility is enforced inside
 * `DiscussionDatabase.queryFeed` itself (see `drizzle-database.ts`) via a per-row access
 * predicate — never by fetching everything and filtering in this function, which would both leak
 * page-size guarantees and (worse) require pulling inaccessible rows into application memory.
 */
export async function getFeedForActor(
  database: DiscussionDatabase,
  actor: DiscussionActor | null | undefined,
  input: DiscussionFeedFilterInput,
): Promise<DiscussionFeedPage> {
  requireActor(actor);
  const filter = discussionFeedFilterSchema.parse(input);
  return database.queryFeed(filter, actor);
}
