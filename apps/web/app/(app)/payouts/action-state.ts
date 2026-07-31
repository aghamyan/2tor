export interface PayoutActionState {
  status: "idle" | "success" | "error";
  message:
    | null
    | "earningsApproved"
    | "batchCreated"
    | "batchCompleted"
    | "errors.unauthenticated"
    | "errors.forbidden"
    | "errors.emptyBatch"
    | "errors.duplicateBatch"
    | "errors.fxMismatch"
    | "errors.evidenceRequired"
    | "errors.invalid"
    | "errors.generic";
  fieldErrors: Record<string, string[] | undefined>;
}

export const INITIAL_PAYOUT_ACTION_STATE: PayoutActionState = {
  status: "idle",
  message: null,
  fieldErrors: {},
};
