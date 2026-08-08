CREATE TABLE "discussion_helpful_votes" (
	"id" text PRIMARY KEY NOT NULL,
	"answer_id" text NOT NULL,
	"voter_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "discussion_helpful_votes" ADD CONSTRAINT "discussion_helpful_votes_answer_id_discussion_answers_id_fk" FOREIGN KEY ("answer_id") REFERENCES "public"."discussion_answers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_helpful_votes" ADD CONSTRAINT "discussion_helpful_votes_voter_user_id_users_id_fk" FOREIGN KEY ("voter_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "discussion_helpful_votes_unique" ON "discussion_helpful_votes" USING btree ("answer_id","voter_user_id");--> statement-breakpoint
CREATE INDEX "discussion_helpful_votes_voter_idx" ON "discussion_helpful_votes" USING btree ("voter_user_id","created_at");