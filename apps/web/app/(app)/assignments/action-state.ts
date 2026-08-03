export interface AssignmentActionState {
  status: "idle" | "success" | "error";
  message:
    | null
    | "assignmentCreated"
    | "assignmentPublished"
    | "assignmentClosed"
    | "saved"
    | "submitted"
    | "graded"
    | "rubricCreated"
    | "errors.unauthenticated"
    | "errors.forbidden"
    | "errors.notFound"
    | "errors.conflict"
    | "errors.invalid"
    | "errors.generic";
  fieldErrors: Record<string, string[]>;
}

export const initialAssignmentActionState: AssignmentActionState = {
  status: "idle",
  message: null,
  fieldErrors: {},
};
