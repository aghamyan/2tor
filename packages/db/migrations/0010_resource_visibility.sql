CREATE TYPE "public"."resource_visibility" AS ENUM('everyone', 'grades', 'students');--> statement-breakpoint
CREATE TABLE "resource_grade_levels" (
	"id" text PRIMARY KEY NOT NULL,
	"resource_id" text NOT NULL,
	"grade_level" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "resources" ADD COLUMN "visibility" "resource_visibility" DEFAULT 'everyone' NOT NULL;--> statement-breakpoint
ALTER TABLE "tutor_content_uploads" ADD COLUMN "file_name" text;--> statement-breakpoint
ALTER TABLE "tutor_content_uploads" ADD COLUMN "mime_type" text;--> statement-breakpoint
ALTER TABLE "tutor_content_uploads" ADD COLUMN "size_bytes" integer;--> statement-breakpoint
ALTER TABLE "resource_grade_levels" ADD CONSTRAINT "resource_grade_levels_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "resource_grade_levels_unique" ON "resource_grade_levels" USING btree ("resource_id","grade_level");