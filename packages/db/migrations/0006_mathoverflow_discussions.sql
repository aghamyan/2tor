CREATE TYPE "public"."abuse_report_severity" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."discussion_answer_verification_status" AS ENUM('unverified', 'correct', 'mostly_correct', 'correct_approach_arithmetic_error', 'needs_revision', 'incorrect', 'incomplete_explanation');--> statement-breakpoint
CREATE TYPE "public"."discussion_question_type" AS ENUM('concept_explanation', 'homework_help', 'check_my_solution', 'alternative_method', 'exam_preparation', 'proof_review', 'general_discussion');--> statement-breakpoint
CREATE TYPE "public"."discussion_visibility" AS ENUM('private_support', 'group_shared', 'tutors_only', 'community');--> statement-breakpoint
CREATE TYPE "public"."discussion_correction_status" AS ENUM('pending', 'accepted', 'partially_accepted', 'rejected', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."discussion_notification_type" AS ENUM('question_answered', 'question_commented', 'user_mentioned', 'answer_accepted', 'answer_unaccepted', 'answer_tutor_verified', 'answer_revision_requested', 'answer_tutor_rated', 'answer_tutor_rating_updated', 'answer_tutor_rating_removed', 'answer_correction_suggested', 'answer_correction_resolved', 'followed_question_activity', 'content_moderation_updated');--> statement-breakpoint
CREATE TYPE "public"."discussion_revision_entity_type" AS ENUM('question', 'answer');--> statement-breakpoint
ALTER TYPE "public"."abuse_report_target_type" ADD VALUE 'discussion_comment' BEFORE 'user';--> statement-breakpoint
ALTER TYPE "public"."discussion_question_status" ADD VALUE 'accepted' BEFORE 'closed';--> statement-breakpoint
ALTER TYPE "public"."discussion_question_status" ADD VALUE 'tutor_verified' BEFORE 'closed';--> statement-breakpoint
ALTER TYPE "public"."discussion_question_status" ADD VALUE 'needs_tutor_review' BEFORE 'closed';--> statement-breakpoint
ALTER TYPE "public"."discussion_question_status" ADD VALUE 'needs_clarification' BEFORE 'closed';--> statement-breakpoint
ALTER TYPE "public"."discussion_question_status" ADD VALUE 'locked';--> statement-breakpoint
ALTER TYPE "public"."discussion_question_status" ADD VALUE 'duplicate';--> statement-breakpoint
ALTER TYPE "public"."discussion_question_status" ADD VALUE 'resolved';--> statement-breakpoint
ALTER TYPE "public"."discussion_question_status" ADD VALUE 'pending_moderation';--> statement-breakpoint
CREATE TABLE "discussion_answer_tutor_ratings" (
	"id" text PRIMARY KEY NOT NULL,
	"answer_id" text NOT NULL,
	"tutor_id" text NOT NULL,
	"rating" integer NOT NULL,
	"public_feedback" text,
	"deleted_at" timestamp with time zone,
	"invalidated_at" timestamp with time zone,
	"invalidated_by_id" text,
	"invalidation_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "discussion_answer_tutor_ratings_range" CHECK ("discussion_answer_tutor_ratings"."rating" >= 1 and "discussion_answer_tutor_ratings"."rating" <= 5)
);
--> statement-breakpoint
CREATE TABLE "discussion_attachments" (
	"id" text PRIMARY KEY NOT NULL,
	"question_id" text NOT NULL,
	"uploaded_by_user_id" text NOT NULL,
	"file_key" text NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"virus_scan_status" "virus_scan_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discussion_bookmarks" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"question_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discussion_comments" (
	"id" text PRIMARY KEY NOT NULL,
	"author_user_id" text NOT NULL,
	"question_id" text,
	"answer_id" text,
	"parent_comment_id" text,
	"body" text NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "discussion_comments_exactly_one_target" CHECK (("discussion_comments"."question_id" is not null) <> ("discussion_comments"."answer_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "discussion_corrections" (
	"id" text PRIMARY KEY NOT NULL,
	"answer_id" text NOT NULL,
	"proposed_by_id" text NOT NULL,
	"issue_description" text NOT NULL,
	"proposed_correction" text NOT NULL,
	"explanation" text,
	"status" "discussion_correction_status" DEFAULT 'pending' NOT NULL,
	"author_response" text,
	"resolved_by_id" text,
	"resolution_note" text,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discussion_follows" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"question_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discussion_notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"recipient_id" text NOT NULL,
	"actor_id" text,
	"type" "discussion_notification_type" NOT NULL,
	"question_id" text,
	"answer_id" text,
	"rating_id" text,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discussion_question_tags" (
	"id" text PRIMARY KEY NOT NULL,
	"question_id" text NOT NULL,
	"tag_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discussion_revisions" (
	"id" text PRIMARY KEY NOT NULL,
	"entity_type" "discussion_revision_entity_type" NOT NULL,
	"entity_id" text NOT NULL,
	"editor_id" text NOT NULL,
	"previous_body" text NOT NULL,
	"new_body" text NOT NULL,
	"edit_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discussion_tags" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"color_token" text,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "discussion_tags_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "discussion_questions" ALTER COLUMN "discussion_space_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "abuse_reports" ADD COLUMN "details" text;--> statement-breakpoint
ALTER TABLE "abuse_reports" ADD COLUMN "severity" "abuse_report_severity";--> statement-breakpoint
ALTER TABLE "abuse_reports" ADD COLUMN "escalated" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "abuse_reports" ADD COLUMN "assigned_moderator_id" text;--> statement-breakpoint
ALTER TABLE "abuse_reports" ADD COLUMN "resolution_note" text;--> statement-breakpoint
ALTER TABLE "discussion_answers" ADD COLUMN "body_format" text DEFAULT 'markdown' NOT NULL;--> statement-breakpoint
ALTER TABLE "discussion_answers" ADD COLUMN "is_tutor_answer" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "discussion_answers" ADD COLUMN "verification_status" "discussion_answer_verification_status" DEFAULT 'unverified' NOT NULL;--> statement-breakpoint
ALTER TABLE "discussion_answers" ADD COLUMN "verification_note" text;--> statement-breakpoint
ALTER TABLE "discussion_answers" ADD COLUMN "verified_by_user_id" text;--> statement-breakpoint
ALTER TABLE "discussion_answers" ADD COLUMN "verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "discussion_answers" ADD COLUMN "tutor_rating_average" numeric(3, 2);--> statement-breakpoint
ALTER TABLE "discussion_answers" ADD COLUMN "tutor_rating_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "discussion_answers" ADD COLUMN "revised_after_rating_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "discussion_answers" ADD COLUMN "pii_flags" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "discussion_answers" ADD COLUMN "locked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "discussion_answers" ADD COLUMN "locked_by_id" text;--> statement-breakpoint
ALTER TABLE "discussion_answers" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "discussion_questions" ADD COLUMN "student_profile_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "discussion_questions" ADD COLUMN "slug" text NOT NULL;--> statement-breakpoint
ALTER TABLE "discussion_questions" ADD COLUMN "body_format" text DEFAULT 'markdown' NOT NULL;--> statement-breakpoint
ALTER TABLE "discussion_questions" ADD COLUMN "subject_id" text;--> statement-breakpoint
ALTER TABLE "discussion_questions" ADD COLUMN "topic_id" text;--> statement-breakpoint
ALTER TABLE "discussion_questions" ADD COLUMN "grade_level" text;--> statement-breakpoint
ALTER TABLE "discussion_questions" ADD COLUMN "course_id" text;--> statement-breakpoint
ALTER TABLE "discussion_questions" ADD COLUMN "question_type" "discussion_question_type" DEFAULT 'general_discussion' NOT NULL;--> statement-breakpoint
ALTER TABLE "discussion_questions" ADD COLUMN "what_tried" text;--> statement-breakpoint
ALTER TABLE "discussion_questions" ADD COLUMN "visibility" "discussion_visibility" DEFAULT 'private_support' NOT NULL;--> statement-breakpoint
ALTER TABLE "discussion_questions" ADD COLUMN "related_class_id" text;--> statement-breakpoint
ALTER TABLE "discussion_questions" ADD COLUMN "accepted_answer_id" text;--> statement-breakpoint
ALTER TABLE "discussion_questions" ADD COLUMN "duplicate_of_question_id" text;--> statement-breakpoint
ALTER TABLE "discussion_questions" ADD COLUMN "pii_flags" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "discussion_questions" ADD COLUMN "view_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "discussion_questions" ADD COLUMN "last_activity_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "discussion_questions" ADD COLUMN "locked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "discussion_questions" ADD COLUMN "locked_by_id" text;--> statement-breakpoint
ALTER TABLE "discussion_questions" ADD COLUMN "closed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "discussion_questions" ADD COLUMN "closed_by_id" text;--> statement-breakpoint
ALTER TABLE "discussion_questions" ADD COLUMN "closed_reason" text;--> statement-breakpoint
ALTER TABLE "discussion_questions" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "discussion_answer_tutor_ratings" ADD CONSTRAINT "discussion_answer_tutor_ratings_answer_id_discussion_answers_id_fk" FOREIGN KEY ("answer_id") REFERENCES "public"."discussion_answers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_answer_tutor_ratings" ADD CONSTRAINT "discussion_answer_tutor_ratings_tutor_id_users_id_fk" FOREIGN KEY ("tutor_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_answer_tutor_ratings" ADD CONSTRAINT "discussion_answer_tutor_ratings_invalidated_by_id_users_id_fk" FOREIGN KEY ("invalidated_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_attachments" ADD CONSTRAINT "discussion_attachments_question_id_discussion_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."discussion_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_attachments" ADD CONSTRAINT "discussion_attachments_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_bookmarks" ADD CONSTRAINT "discussion_bookmarks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_bookmarks" ADD CONSTRAINT "discussion_bookmarks_question_id_discussion_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."discussion_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_comments" ADD CONSTRAINT "discussion_comments_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_comments" ADD CONSTRAINT "discussion_comments_question_id_discussion_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."discussion_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_comments" ADD CONSTRAINT "discussion_comments_answer_id_discussion_answers_id_fk" FOREIGN KEY ("answer_id") REFERENCES "public"."discussion_answers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_comments" ADD CONSTRAINT "discussion_comments_parent_comment_id_discussion_comments_id_fk" FOREIGN KEY ("parent_comment_id") REFERENCES "public"."discussion_comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_corrections" ADD CONSTRAINT "discussion_corrections_answer_id_discussion_answers_id_fk" FOREIGN KEY ("answer_id") REFERENCES "public"."discussion_answers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_corrections" ADD CONSTRAINT "discussion_corrections_proposed_by_id_users_id_fk" FOREIGN KEY ("proposed_by_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_corrections" ADD CONSTRAINT "discussion_corrections_resolved_by_id_users_id_fk" FOREIGN KEY ("resolved_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_follows" ADD CONSTRAINT "discussion_follows_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_follows" ADD CONSTRAINT "discussion_follows_question_id_discussion_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."discussion_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_notifications" ADD CONSTRAINT "discussion_notifications_recipient_id_users_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_notifications" ADD CONSTRAINT "discussion_notifications_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_notifications" ADD CONSTRAINT "discussion_notifications_question_id_discussion_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."discussion_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_notifications" ADD CONSTRAINT "discussion_notifications_answer_id_discussion_answers_id_fk" FOREIGN KEY ("answer_id") REFERENCES "public"."discussion_answers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_notifications" ADD CONSTRAINT "discussion_notifications_rating_id_discussion_answer_tutor_ratings_id_fk" FOREIGN KEY ("rating_id") REFERENCES "public"."discussion_answer_tutor_ratings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_question_tags" ADD CONSTRAINT "discussion_question_tags_question_id_discussion_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."discussion_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_question_tags" ADD CONSTRAINT "discussion_question_tags_tag_id_discussion_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."discussion_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_revisions" ADD CONSTRAINT "discussion_revisions_editor_id_users_id_fk" FOREIGN KEY ("editor_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "discussion_answer_tutor_ratings_active_unique" ON "discussion_answer_tutor_ratings" USING btree ("answer_id","tutor_id") WHERE "discussion_answer_tutor_ratings"."deleted_at" is null and "discussion_answer_tutor_ratings"."invalidated_at" is null;--> statement-breakpoint
CREATE INDEX "discussion_answer_tutor_ratings_answer_idx" ON "discussion_answer_tutor_ratings" USING btree ("answer_id");--> statement-breakpoint
CREATE INDEX "discussion_answer_tutor_ratings_tutor_idx" ON "discussion_answer_tutor_ratings" USING btree ("tutor_id");--> statement-breakpoint
CREATE INDEX "discussion_answer_tutor_ratings_rating_idx" ON "discussion_answer_tutor_ratings" USING btree ("rating");--> statement-breakpoint
CREATE UNIQUE INDEX "discussion_bookmarks_unique" ON "discussion_bookmarks" USING btree ("user_id","question_id");--> statement-breakpoint
CREATE INDEX "discussion_comments_question_idx" ON "discussion_comments" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "discussion_comments_answer_idx" ON "discussion_comments" USING btree ("answer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "discussion_follows_unique" ON "discussion_follows" USING btree ("user_id","question_id");--> statement-breakpoint
CREATE INDEX "discussion_notifications_recipient_idx" ON "discussion_notifications" USING btree ("recipient_id","read_at");--> statement-breakpoint
CREATE UNIQUE INDEX "discussion_question_tags_unique" ON "discussion_question_tags" USING btree ("question_id","tag_id");--> statement-breakpoint
CREATE INDEX "discussion_question_tags_tag_idx" ON "discussion_question_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "discussion_revisions_entity_idx" ON "discussion_revisions" USING btree ("entity_type","entity_id");--> statement-breakpoint
ALTER TABLE "abuse_reports" ADD CONSTRAINT "abuse_reports_assigned_moderator_id_users_id_fk" FOREIGN KEY ("assigned_moderator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_answers" ADD CONSTRAINT "discussion_answers_verified_by_user_id_users_id_fk" FOREIGN KEY ("verified_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_answers" ADD CONSTRAINT "discussion_answers_locked_by_id_users_id_fk" FOREIGN KEY ("locked_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_questions" ADD CONSTRAINT "discussion_questions_student_profile_id_student_profiles_id_fk" FOREIGN KEY ("student_profile_id") REFERENCES "public"."student_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_questions" ADD CONSTRAINT "discussion_questions_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_questions" ADD CONSTRAINT "discussion_questions_topic_id_skills_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."skills"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_questions" ADD CONSTRAINT "discussion_questions_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_questions" ADD CONSTRAINT "discussion_questions_related_class_id_courses_id_fk" FOREIGN KEY ("related_class_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_questions" ADD CONSTRAINT "discussion_questions_duplicate_of_question_id_discussion_questions_id_fk" FOREIGN KEY ("duplicate_of_question_id") REFERENCES "public"."discussion_questions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_questions" ADD CONSTRAINT "discussion_questions_locked_by_id_users_id_fk" FOREIGN KEY ("locked_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_questions" ADD CONSTRAINT "discussion_questions_closed_by_id_users_id_fk" FOREIGN KEY ("closed_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "abuse_reports_status_idx" ON "abuse_reports" USING btree ("status");--> statement-breakpoint
CREATE INDEX "abuse_reports_assigned_moderator_idx" ON "abuse_reports" USING btree ("assigned_moderator_id");--> statement-breakpoint
CREATE INDEX "abuse_reports_target_idx" ON "abuse_reports" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "discussion_answers_question_idx" ON "discussion_answers" USING btree ("discussion_question_id");--> statement-breakpoint
CREATE INDEX "discussion_answers_verification_status_idx" ON "discussion_answers" USING btree ("verification_status");--> statement-breakpoint
CREATE INDEX "discussion_answers_author_idx" ON "discussion_answers" USING btree ("author_user_id");--> statement-breakpoint
CREATE INDEX "discussion_questions_status_idx" ON "discussion_questions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "discussion_questions_visibility_idx" ON "discussion_questions" USING btree ("visibility");--> statement-breakpoint
CREATE INDEX "discussion_questions_author_idx" ON "discussion_questions" USING btree ("author_user_id");--> statement-breakpoint
CREATE INDEX "discussion_questions_subject_idx" ON "discussion_questions" USING btree ("subject_id");--> statement-breakpoint
CREATE INDEX "discussion_questions_topic_idx" ON "discussion_questions" USING btree ("topic_id");--> statement-breakpoint
CREATE INDEX "discussion_questions_course_idx" ON "discussion_questions" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "discussion_questions_grade_level_idx" ON "discussion_questions" USING btree ("grade_level");--> statement-breakpoint
CREATE INDEX "discussion_questions_last_activity_idx" ON "discussion_questions" USING btree ("last_activity_at");--> statement-breakpoint
CREATE INDEX "discussion_questions_created_at_idx" ON "discussion_questions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "discussion_questions_search_idx" ON "discussion_questions" USING gin (to_tsvector('english', coalesce("title", '') || ' ' || coalesce("body", '')));--> statement-breakpoint
ALTER TABLE "discussion_questions" ADD CONSTRAINT "discussion_questions_slug_unique" UNIQUE("slug");