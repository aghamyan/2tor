import { requireActor } from "./capabilities";
import type { DiscussionActor, DiscussionDatabase, DiscussionTagRecord } from "./models";

export async function listTagsForActor(
  database: DiscussionDatabase,
  actor: DiscussionActor | null | undefined,
  search?: string,
): Promise<DiscussionTagRecord[]> {
  requireActor(actor);
  return database.listTags(search);
}

export async function setQuestionTags(
  database: DiscussionDatabase,
  questionId: string,
  tagNames: string[],
): Promise<DiscussionTagRecord[]> {
  const tags = await database.getOrCreateTagsByName(tagNames);
  await database.setQuestionTags(
    questionId,
    tags.map((tag) => tag.id),
  );
  return tags;
}
