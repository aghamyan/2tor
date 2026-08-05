"use client";

export interface CameraHandle {
  stream: MediaStream;
  stop: () => void;
}

export class CameraUnavailableError extends Error {
  constructor(public readonly reason: "unsupported" | "denied" | "no-device" | "unknown") {
    super(`Camera unavailable: ${reason}`);
    this.name = "CameraUnavailableError";
  }
}

/** Requests the front-facing camera. Never touches the microphone — audio is out of scope. */
export async function requestCameraStream(): Promise<CameraHandle> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    throw new CameraUnavailableError("unsupported");
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
      audio: false,
    });
    return {
      stream,
      stop: () => {
        for (const track of stream.getTracks()) track.stop();
      },
    };
  } catch (error) {
    if (error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "SecurityError")) {
      throw new CameraUnavailableError("denied");
    }
    if (error instanceof DOMException && error.name === "NotFoundError") {
      throw new CameraUnavailableError("no-device");
    }
    throw new CameraUnavailableError("unknown");
  }
}

/** Watches the live track for the browser ending or muting it mid-attempt (device unplugged, OS-level revoke, app switch on some platforms). */
export function watchCameraHealth(stream: MediaStream, onDisconnected: () => void): () => void {
  const [track] = stream.getVideoTracks();
  if (!track) return () => {};
  track.addEventListener("ended", onDisconnected);
  track.addEventListener("mute", onDisconnected);
  return () => {
    track.removeEventListener("ended", onDisconnected);
    track.removeEventListener("mute", onDisconnected);
  };
}
