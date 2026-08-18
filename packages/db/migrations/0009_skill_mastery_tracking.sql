CREATE TYPE "public"."skill_calculation_method" AS ENUM('tutor', 'automatic');--> statement-breakpoint
CREATE TYPE "public"."skill_confidence" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."skill_evidence_type" AS ENUM('tutor_observation', 'homework', 'lesson_activity', 'diagnostic', 'assessment');--> statement-breakpoint
CREATE TYPE "public"."skill_mastery_status" AS ENUM('mastered', 'secure', 'developing', 'needs_attention', 'not_demonstrated', 'not_assessed', 'in_progress', 'upcoming');--> statement-breakpoint
CREATE TYPE "public"."skill_trend" AS ENUM('up', 'down', 'steady', 'new');--> statement-breakpoint
CREATE TABLE "curriculum_units" (
	"id" text PRIMARY KEY NOT NULL,
	"course_id" text NOT NULL,
	"order_index" integer NOT NULL,
	"name_en" text NOT NULL,
	"name_hy" text,
	"lessons" integer,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skill_assessment_events" (
	"id" text PRIMARY KEY NOT NULL,
	"student_profile_id" text NOT NULL,
	"skill_id" text NOT NULL,
	"lesson_id" text,
	"feedback_id" text,
	"score" numeric(3, 1),
	"status" "skill_mastery_status" NOT NULL,
	"confidence" "skill_confidence",
	"evidence_type" "skill_evidence_type" NOT NULL,
	"calculation_method" "skill_calculation_method" DEFAULT 'tutor' NOT NULL,
	"note" text,
	"visible_to_parent" boolean DEFAULT true NOT NULL,
	"visible_to_student" boolean DEFAULT true NOT NULL,
	"recorded_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skill_prerequisites" (
	"id" text PRIMARY KEY NOT NULL,
	"skill_id" text NOT NULL,
	"prerequisite_skill_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "code" text;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "grade_label" text;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "hours" integer;--> statement-breakpoint
ALTER TABLE "learning_plan_items" ADD COLUMN "skill_id" text;--> statement-breakpoint
ALTER TABLE "skills" ADD COLUMN "unit_id" text;--> statement-breakpoint
ALTER TABLE "skills" ADD COLUMN "order_index" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "skills" ADD COLUMN "code" text;--> statement-breakpoint
ALTER TABLE "skills" ADD COLUMN "mastery_criteria" jsonb;--> statement-breakpoint
ALTER TABLE "skills" ADD COLUMN "misconceptions" jsonb;--> statement-breakpoint
ALTER TABLE "skills" ADD COLUMN "created_by_user_id" text;--> statement-breakpoint
ALTER TABLE "student_skill_records" ADD COLUMN "status" "skill_mastery_status" DEFAULT 'not_assessed' NOT NULL;--> statement-breakpoint
ALTER TABLE "student_skill_records" ADD COLUMN "score" numeric(3, 1);--> statement-breakpoint
ALTER TABLE "student_skill_records" ADD COLUMN "confidence" "skill_confidence";--> statement-breakpoint
ALTER TABLE "student_skill_records" ADD COLUMN "trend" "skill_trend" DEFAULT 'new' NOT NULL;--> statement-breakpoint
ALTER TABLE "student_skill_records" ADD COLUMN "evidence_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "student_skill_records" ADD COLUMN "visible_to_parent" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "student_skill_records" ADD COLUMN "visible_to_student" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "student_skill_records" ADD COLUMN "last_event_id" text;--> statement-breakpoint
ALTER TABLE "curriculum_units" ADD CONSTRAINT "curriculum_units_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_assessment_events" ADD CONSTRAINT "skill_assessment_events_student_profile_id_student_profiles_id_fk" FOREIGN KEY ("student_profile_id") REFERENCES "public"."student_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_assessment_events" ADD CONSTRAINT "skill_assessment_events_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_assessment_events" ADD CONSTRAINT "skill_assessment_events_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_assessment_events" ADD CONSTRAINT "skill_assessment_events_feedback_id_lesson_feedback_id_fk" FOREIGN KEY ("feedback_id") REFERENCES "public"."lesson_feedback"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_assessment_events" ADD CONSTRAINT "skill_assessment_events_recorded_by_user_id_users_id_fk" FOREIGN KEY ("recorded_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_prerequisites" ADD CONSTRAINT "skill_prerequisites_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_prerequisites" ADD CONSTRAINT "skill_prerequisites_prerequisite_skill_id_skills_id_fk" FOREIGN KEY ("prerequisite_skill_id") REFERENCES "public"."skills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "curriculum_units_unique" ON "curriculum_units" USING btree ("course_id","order_index");--> statement-breakpoint
CREATE UNIQUE INDEX "skill_prerequisites_unique" ON "skill_prerequisites" USING btree ("skill_id","prerequisite_skill_id");--> statement-breakpoint
ALTER TABLE "learning_plan_items" ADD CONSTRAINT "learning_plan_items_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skills" ADD CONSTRAINT "skills_unit_id_curriculum_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."curriculum_units"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skills" ADD CONSTRAINT "skills_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_skill_records" ADD CONSTRAINT "student_skill_records_last_event_id_skill_assessment_events_id_fk" FOREIGN KEY ("last_event_id") REFERENCES "public"."skill_assessment_events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "student_skill_records_unique" ON "student_skill_records" USING btree ("student_profile_id","skill_id");--> statement-breakpoint
ALTER TABLE "student_skill_records" DROP COLUMN "level";--> statement-breakpoint
ALTER TABLE "student_skill_records" DROP COLUMN "source";--> statement-breakpoint
ALTER TABLE "student_skill_records" DROP COLUMN "notes";--> statement-breakpoint
ALTER TABLE "student_skill_records" DROP COLUMN "created_at";--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_code_unique" UNIQUE("code");