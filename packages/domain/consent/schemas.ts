import { z } from "zod";

export const CONSENT_METHOD_KEYS = [
  "signed_form",
  "identity_verification",
  "video_call",
  "payment_card_verification",
  "other",
] as const;

export const consentMethodKeySchema = z.enum(CONSENT_METHOD_KEYS);

/**
 * The current direct-notice version and the exact data categories it discloses. A parent does
 * not pick a subset of these — a direct notice is disclosed and consented to as a whole. Revising
 * what's collected means shipping a new `CURRENT_CONSENT_VERSION` (and category set), not letting
 * a parent partially opt in per category. `recordConsent` always stores this constant, never a
 * client-supplied list.
 */
export const CURRENT_CONSENT_VERSION = "2026-01-v1";
export const CURRENT_CONSENT_DATA_CATEGORIES = [
  "identity_profile",
  "academic_records",
  "contact_info",
  "communications",
  "payment_billing",
] as const;

export const recordConsentInputSchema = z
  .object({
    studentProfileId: z.string().trim().min(1),
    /**
     * A separate, explicit acknowledgement of the direct child-data notice — distinct from any
     * general Terms-of-Service checkbox. Required, but on its own it is still not the verifiable
     * consent step; `method`/`evidence` below must also pass a `ConsentMethod.verify()` check.
     */
    noticeAcknowledged: z.literal(true),
    method: consentMethodKeySchema,
    /** Method-specific payload; the resolved `ConsentMethod` validates its own shape. */
    evidence: z.record(z.string(), z.unknown()),
  })
  .strict();

export type RecordConsentInput = z.infer<typeof recordConsentInputSchema>;

export const activateStudentInputSchema = z
  .object({
    studentProfileId: z.string().trim().min(1),
  })
  .strict();

export type ActivateStudentInput = z.infer<typeof activateStudentInputSchema>;
