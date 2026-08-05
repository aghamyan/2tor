CREATE TYPE "public"."whatsapp_group_member_role" AS ENUM('tutor', 'parent', 'student');--> statement-breakpoint
CREATE TYPE "public"."whatsapp_group_member_status" AS ENUM('invited', 'joined', 'removed');--> statement-breakpoint
CREATE TYPE "public"."whatsapp_group_status" AS ENUM('not_provisioned', 'active', 'disabled');--> statement-breakpoint
CREATE TABLE "whatsapp_group_members" (
	"id" text PRIMARY KEY NOT NULL,
	"whatsapp_group_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" "whatsapp_group_member_role" NOT NULL,
	"phone_number" text NOT NULL,
	"status" "whatsapp_group_member_status" DEFAULT 'invited' NOT NULL,
	"invited_at" timestamp with time zone DEFAULT now() NOT NULL,
	"joined_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "whatsapp_groups" (
	"id" text PRIMARY KEY NOT NULL,
	"student_profile_id" text NOT NULL,
	"status" "whatsapp_group_status" DEFAULT 'not_provisioned' NOT NULL,
	"provider_group_id" text,
	"invite_link" text,
	"reminder_lead_minutes" integer DEFAULT 60 NOT NULL,
	"is_enabled" boolean DEFAULT false NOT NULL,
	"include_child" boolean DEFAULT false NOT NULL,
	"updated_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "whatsapp_groups_student_profile_id_unique" UNIQUE("student_profile_id")
);
--> statement-breakpoint
CREATE TABLE "whatsapp_lesson_notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"lesson_id" text NOT NULL,
	"reminder_sent_at" timestamp with time zone,
	"class_ended_sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "whatsapp_lesson_notifications_lesson_id_unique" UNIQUE("lesson_id")
);
--> statement-breakpoint
ALTER TABLE "student_profiles" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "tutor_profiles" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "whatsapp_group_members" ADD CONSTRAINT "whatsapp_group_members_whatsapp_group_id_whatsapp_groups_id_fk" FOREIGN KEY ("whatsapp_group_id") REFERENCES "public"."whatsapp_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_group_members" ADD CONSTRAINT "whatsapp_group_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_groups" ADD CONSTRAINT "whatsapp_groups_student_profile_id_student_profiles_id_fk" FOREIGN KEY ("student_profile_id") REFERENCES "public"."student_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_groups" ADD CONSTRAINT "whatsapp_groups_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_lesson_notifications" ADD CONSTRAINT "whatsapp_lesson_notifications_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "whatsapp_group_members_unique" ON "whatsapp_group_members" USING btree ("whatsapp_group_id","user_id");