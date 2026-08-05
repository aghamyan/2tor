export type LeadKind =
  | "consultation"
  | "assessment"
  | "contact"
  | "tutor_application"
  | "trial_class"
  | "group_matching";

/**
 * Deliberately small public-contact record. Child names, dates of birth, and learning
 * records do not belong in an unauthenticated marketing form.
 */
export interface MarketingLead {
  id: string;
  kind: LeadKind;
  parentName: string;
  email: string;
  phone: string | null;
  learnerAgeBand: "under_8" | "8_10" | "11_13" | "14_17" | "adult" | null;
  interest: string | null;
  message: string | null;
  locale: "en" | "hy";
  privacyConsentAt: Date;
  retentionUntil: Date;
  createdAt: Date;
}

export interface MarketingLeadDatabase {
  saveLead(lead: MarketingLead): Promise<void>;
}
