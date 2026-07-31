import {
  assignmentSubmissions,
  bookmarks,
  discussionAnswers,
  discussionQuestions,
  matchingNotes,
  messageAttachments,
  messages,
  projectFiles,
  resourceLinks,
  resources,
  studentInterests,
  studentPreferences,
  tutorContentUploads,
  type Database,
} from "@app/db";
import { eq } from "drizzle-orm";

import type { DeletionExecutor, DeletionJobInput } from "./retention";

/**
 * Real, Postgres-backed `DeletionExecutor` — one branch per entity type in `retention.ts`'s
 * `OPTIONAL_CONTENT_ENTITY_TYPES`. `runDeletionJob` only ever calls this for an `"optional"`
 * classification, never `"legal"`/`"unknown"` — see that file's docstring. None of these tables
 * need field-level anonymization instead of a row delete (unlike, say, `users`/`student_profiles`,
 * which are deliberately *not* in the optional catalog): they're educational-content rows with no
 * independent retention requirement of their own, so `"full_erase"` and `"anonymize"` both
 * resolve to removing the row.
 *
 * Lives in this domain package (not `apps/worker`) because it needs `drizzle-orm` directly —
 * `apps/worker/package.json` doesn't declare it (only `@app/db`, `bullmq`, `ioredis`), so under
 * this workspace's strict pnpm linking a bare `import ... from "drizzle-orm"` placed inside an
 * `apps/worker/**` file fails to resolve, confirmed via `pnpm --filter worker typecheck`.
 * `apps/worker/src/jobs/admin/retention-deletion.job.ts` only ever imports the factory below.
 */
export function createDrizzleDeletionExecutor(db: Database): DeletionExecutor {
  return {
    async deleteEntity(input: DeletionJobInput): Promise<void> {
      switch (input.targetEntityType) {
        case "bookmarks":
          await db.delete(bookmarks).where(eq(bookmarks.id, input.targetEntityId));
          return;
        case "resources":
          await db.delete(resources).where(eq(resources.id, input.targetEntityId));
          return;
        case "resource_links":
          await db.delete(resourceLinks).where(eq(resourceLinks.id, input.targetEntityId));
          return;
        case "tutor_content_uploads":
          await db
            .delete(tutorContentUploads)
            .where(eq(tutorContentUploads.id, input.targetEntityId));
          return;
        case "discussion_questions":
          await db
            .delete(discussionQuestions)
            .where(eq(discussionQuestions.id, input.targetEntityId));
          return;
        case "discussion_answers":
          await db.delete(discussionAnswers).where(eq(discussionAnswers.id, input.targetEntityId));
          return;
        case "messages":
          await db.delete(messages).where(eq(messages.id, input.targetEntityId));
          return;
        case "message_attachments":
          await db
            .delete(messageAttachments)
            .where(eq(messageAttachments.id, input.targetEntityId));
          return;
        case "student_interests":
          await db.delete(studentInterests).where(eq(studentInterests.id, input.targetEntityId));
          return;
        case "student_preferences":
          await db
            .delete(studentPreferences)
            .where(eq(studentPreferences.id, input.targetEntityId));
          return;
        case "project_files":
          await db.delete(projectFiles).where(eq(projectFiles.id, input.targetEntityId));
          return;
        case "assignment_submissions":
          await db
            .delete(assignmentSubmissions)
            .where(eq(assignmentSubmissions.id, input.targetEntityId));
          return;
        case "matching_notes":
          await db.delete(matchingNotes).where(eq(matchingNotes.id, input.targetEntityId));
          return;
        default:
          // `runDeletionJob` never reaches here for a `"legal"`/`"unknown"` classification, and
          // every `"optional"` entity type has a case above — this is a genuine registration gap
          // (someone extended `OPTIONAL_CONTENT_ENTITY_TYPES` without a matching branch here).
          throw new Error(
            `No deletion handler registered for entity type "${input.targetEntityType}".`,
          );
      }
    },
  };
}
