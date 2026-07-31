export interface AdminActionState {
  status: "idle" | "success" | "error";
  /** An `@app/i18n` message key under `admin.feedback.*`. */
  message: string | null;
  fieldErrors: Record<string, string[]>;
}

export const initialAdminActionState: AdminActionState = {
  status: "idle",
  message: null,
  fieldErrors: {},
};
