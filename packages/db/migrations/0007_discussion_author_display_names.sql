ALTER TABLE "discussion_answers" ADD COLUMN "author_display_name" text NOT NULL;--> statement-breakpoint
ALTER TABLE "discussion_questions" ADD COLUMN "author_display_name" text NOT NULL;--> statement-breakpoint
ALTER TABLE "discussion_answer_tutor_ratings" ADD COLUMN "tutor_display_name" text NOT NULL;--> statement-breakpoint
ALTER TABLE "discussion_comments" ADD COLUMN "author_display_name" text NOT NULL;--> statement-breakpoint
ALTER TABLE "discussion_corrections" ADD COLUMN "proposed_by_display_name" text NOT NULL;