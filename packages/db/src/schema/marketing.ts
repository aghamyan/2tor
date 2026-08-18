import { pgEnum, pgTable, text } from "drizzle-orm/pg-core";
import { timestamps, ulidPk, utcTimestamp } from "./_common";
import { localeEnum } from "./identity";

/**
 * Public marketing intake: consultation requests, free-class/trial bookings, group-matching
 * signups, and general contact/tutor-application submissions from unauthenticated visitors. This
 * table is deliberately outside the spec §15 core entity list (see packages/db/README.md) — it is
 * a minimal, short-retention contact record, not a product domain entity. `retentionUntil` is the
 * 90-day deletion deadline computed by `packages/domain/marketing` at write time.
 */
export const marketingLeadKindEnum = pgEnum("marketing_lead_kind", [
  "consultation",
  "assessment",
  "contact",
  "tutor_application",
  "trial_class",
  "group_matching",
]);

export const marketingLeads = pgTable("marketing_leads", {
  id: ulidPk(),
  kind: marketingLeadKindEnum("kind").notNull(),
  parentName: text("parent_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  // Free text, not an enum — mirrors student_profiles.age_band's plain-text pattern in families.ts.
  learnerAgeBand: text("learner_age_band"),
  interest: text("interest"),
  message: text("message"),
  locale: localeEnum("locale").notNull(),
  privacyConsentAt: utcTimestamp("privacy_consent_at").notNull(),
  retentionUntil: utcTimestamp("retention_until").notNull(),
  createdAt: timestamps.createdAt,
});
