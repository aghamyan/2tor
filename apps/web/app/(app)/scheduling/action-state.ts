export interface SchedulingActionState {
  status: "idle" | "success" | "error";
  message:
    | null
    | "lessonScheduled"
    | "seriesScheduled"
    | "canceled"
    | "rescheduled"
    | "noShowRecorded"
    | "attendanceRecorded"
    | "completed"
    | "zoomSaved"
    | "errors.unauthenticated"
    | "errors.forbidden"
    | "errors.notFound"
    | "errors.conflict"
    | "errors.invalid"
    | "errors.generic";
  fieldErrors: Record<string, string[]>;
}

export const initialSchedulingActionState: SchedulingActionState = {
  status: "idle",
  message: null,
  fieldErrors: {},
};
