export interface ConsentActionState {
  status: "idle" | "success" | "error";
  message:
    | null
    | "consentRecorded"
    | "activated"
    | "errors.unauthenticated"
    | "errors.forbidden"
    | "errors.notFound"
    | "errors.parentRequired"
    | "errors.contactVerificationRequired"
    | "errors.consentNotApplicable"
    | "errors.methodNotSupported"
    | "errors.verificationFailed"
    | "errors.consentRequired"
    | "errors.familyNotReady"
    | "errors.accountSuspended"
    | "errors.invalid"
    | "errors.generic";
  fieldErrors: Record<string, string[]>;
}

export const initialConsentActionState: ConsentActionState = {
  status: "idle",
  message: null,
  fieldErrors: {},
};
