export interface SessionsActionState {
  status: "idle" | "success" | "error";
  message: null | "feedback.revoked" | "feedback.revokedAll" | "errors.notFound" | "errors.generic";
}

export const initialSessionsActionState: SessionsActionState = {
  status: "idle",
  message: null,
};
