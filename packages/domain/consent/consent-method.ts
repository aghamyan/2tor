import { ulid } from "ulid";
import { z } from "zod";

import { ConsentError } from "./errors";
import type { ConsentMethodKey } from "./models";

export interface ConsentMethodContext {
  parentUserId: string;
  parentProfileId: string;
  studentProfileId: string;
  consentVersion: string;
  dataCategories: readonly string[];
  now: Date;
}

export interface ConsentMethodResult {
  verified: boolean;
  /** Reference to the evidence (not the raw evidence itself — data minimization), or `null` if unverified. */
  identityEvidenceRef: string | null;
  /** Machine-readable reason for a `verified: false` result, for error mapping and audit context. */
  failureReason?: string;
}

/**
 * A pluggable, verifiable-parental-consent check. `key` must match one of
 * `packages/db/src/schema/families.ts`'s `consentMethodEnum` values so a result can be persisted
 * to `consent_records.method` directly. Implementations receive already-schema-validated call
 * context and an opaque `evidence` payload they alone know how to interpret and validate.
 */
export interface ConsentMethod {
  readonly key: ConsentMethodKey;
  verify(context: ConsentMethodContext, evidence: unknown): Promise<ConsentMethodResult>;
}

const signedAttestationEvidenceSchema = z
  .object({
    typedFullName: z.string().trim().min(2).max(120),
    attestationPhrase: z.string().trim(),
  })
  .strict();

/**
 * The exact phrase a parent must type verbatim, distinct from any Terms-of-Service checkbox
 * wording, so the two can never be confused with each other in a review or in an audit event.
 */
export const SIGNED_FORM_ATTESTATION_PHRASE =
  "I am this child's parent or legal guardian and I consent to the collection described above.";

/**
 * TODO(legal): placeholder only. This "type your full legal name and the attestation phrase
 * verbatim" check is a deliberate step *beyond* Terms-of-Service acceptance — it satisfies this
 * module's plumbing (an explicit `ConsentMethod` distinct from ticking Terms) but is NOT a vetted
 * COPPA §312.5(b) "reasonable effort" verification method by itself for monetized covered
 * features. Legal counsel must select and configure the production method before real users rely
 * on this — candidates include a signed paper/PDF consent form returned via mail/fax/upload, a
 * nominal credit-card charge verification, a live video-call check, government-ID verification,
 * or a knowledge-based-authentication vendor. Swap (or add to) the entry in
 * `defaultConsentMethodRegistry` — or pass a custom `ConsentMethodRegistry` into `recordConsent`
 * — once that decision is made; nothing else in this module needs to change.
 */
export const signedAttestationConsentMethod: ConsentMethod = {
  key: "signed_form",
  async verify(_context, evidence) {
    const parsed = signedAttestationEvidenceSchema.safeParse(evidence);
    if (!parsed.success) {
      return { verified: false, identityEvidenceRef: null, failureReason: "invalid_evidence" };
    }
    if (parsed.data.attestationPhrase !== SIGNED_FORM_ATTESTATION_PHRASE) {
      return {
        verified: false,
        identityEvidenceRef: null,
        failureReason: "attestation_phrase_mismatch",
      };
    }
    return { verified: true, identityEvidenceRef: `signed_form:${ulid()}` };
  },
};

export type ConsentMethodRegistry = Partial<Record<ConsentMethodKey, ConsentMethod>>;

export const defaultConsentMethodRegistry: ConsentMethodRegistry = {
  signed_form: signedAttestationConsentMethod,
};

export function resolveConsentMethod(
  registry: ConsentMethodRegistry,
  key: ConsentMethodKey,
): ConsentMethod {
  const method = registry[key];
  if (!method) {
    throw new ConsentError(
      "CONSENT_METHOD_NOT_SUPPORTED",
      `No consent method is registered for "${key}".`,
      400,
    );
  }
  return method;
}
