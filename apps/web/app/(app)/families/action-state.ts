export interface FamilyActionState {
  status: "idle" | "success" | "error";
  message:
    | null
    | "saved"
    | "studentCreated"
    | "unlinked"
    | "errors.unauthenticated"
    | "errors.forbidden"
    | "errors.parentRequired"
    | "errors.usernameTaken"
    | "errors.lastParent"
    | "errors.notFound"
    | "errors.invalid"
    | "errors.generic";
  fieldErrors: Record<string, string[]>;
}

export const initialFamilyActionState: FamilyActionState = {
  status: "idle",
  message: null,
  fieldErrors: {},
};
