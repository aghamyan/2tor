import { SchedulingError } from "./errors";

/**
 * Zoom integration is manual entry in the MVP (spec: "Zoom meeting link and passcode stored per
 * lesson (manual entry now, Zoom API behind a pluggable interface for later)"). `ZoomLinkProvider`
 * is that pluggable seam: `setLessonZoomMeeting()` in services.ts calls whichever provider is
 * injected, so swapping in a real Zoom-API-backed provider later (one that calls Zoom's Create
 * Meeting API and ignores `manualEntry`) is a new implementation of this interface, not a change
 * to any calling code.
 */

export interface ZoomMeetingDetails {
  zoomMeetingId: string;
  joinUrl: string;
  startUrl: string | null;
  passcode: string | null;
}

export interface ManualZoomEntryInput {
  joinUrl: string;
  passcode: string | null;
  startUrl?: string | null;
  /** Optional external Zoom meeting id, if the tutor/admin has it handy (e.g. from their own Zoom account). */
  zoomMeetingId?: string | null;
}

export interface ZoomProvisionRequest {
  lessonId: string;
  scheduledStartAt: Date;
  scheduledEndAt: Date;
  topic: string;
  /** Required for a `"manual"` provider; ignored by a future `"api"` provider that creates its own meeting. */
  manualEntry?: ManualZoomEntryInput;
}

export interface ZoomLinkProvider {
  /** Surfaced in audit records so a manual vs. API-provisioned meeting is distinguishable after the fact. */
  readonly kind: "manual" | "api";
  provision(request: ZoomProvisionRequest): Promise<ZoomMeetingDetails>;
}

/** The only provider wired up today. Trusts the caller-supplied join URL/passcode as-is (validated at the Zod boundary in schemas.ts). */
export function createManualZoomLinkProvider(): ZoomLinkProvider {
  return {
    kind: "manual",
    async provision(request) {
      if (!request.manualEntry) {
        throw new SchedulingError(
          "ZOOM_PROVISION_FAILED",
          "Manual Zoom entry requires a join URL and passcode.",
          400,
        );
      }
      return {
        zoomMeetingId: request.manualEntry.zoomMeetingId ?? `manual:${request.lessonId}`,
        joinUrl: request.manualEntry.joinUrl,
        startUrl: request.manualEntry.startUrl ?? null,
        passcode: request.manualEntry.passcode ?? null,
      };
    },
  };
}
