CREATE TYPE "public"."marketing_lead_kind" AS ENUM('consultation', 'assessment', 'contact', 'tutor_application', 'trial_class', 'group_matching');--> statement-breakpoint
CREATE TABLE "marketing_leads" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" "marketing_lead_kind" NOT NULL,
	"parent_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"learner_age_band" text,
	"interest" text,
	"message" text,
	"locale" "locale" NOT NULL,
	"privacy_consent_at" timestamp with time zone NOT NULL,
	"retention_until" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
