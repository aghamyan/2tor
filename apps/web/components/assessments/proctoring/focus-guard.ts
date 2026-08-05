"use client";

import type { SignalBus } from "./signal-bus";

export interface FocusGuardCallbacks {
  onFullscreenExit?: () => void;
  onFullscreenEnter?: () => void;
}

export interface FocusGuardOptions {
  /**
   * Signals are suppressed for this long after install (default 2500ms). The "Begin assessment"
   * click both requests fullscreen and mounts this guard in the same tick; the fullscreen
   * transition's own trailing blur/visibilitychange/resize events would otherwise be
   * misread as the student having just switched away, the moment the exam starts.
   */
  graceMs?: number;
}

const DEFAULT_GRACE_MS = 2_500;

/**
 * Window/tab/fullscreen integrity signals (spec §4-5). `blur` and `visibilitychange` fire
 * together in most browsers when a student switches tabs; the guard skips `focus_loss` in that
 * case so one real action doesn't log as two signals (spec's "avoid false positives").
 */
export function installFocusGuard(
  bus: SignalBus,
  callbacks: FocusGuardCallbacks = {},
  options: FocusGuardOptions = {},
): () => void {
  let fullscreenEntered = typeof document !== "undefined" && Boolean(document.fullscreenElement);
  const installedAt = Date.now();
  const graceMs = options.graceMs ?? DEFAULT_GRACE_MS;
  // Only flag "minimized" on a transition from a known-good size to zero — some environments
  // (embedded webviews, certain window managers, automated browsers) never populate outerWidth/
  // outerHeight at all, which would otherwise misclassify the very first tab switch every time.
  let lastKnownGoodSize = window.outerWidth > 0 && window.outerHeight > 0;

  function withinGrace() {
    return Date.now() - installedAt < graceMs;
  }

  function handleVisibility() {
    if (document.visibilityState !== "hidden" || withinGrace()) return;
    const zeroed = window.outerHeight === 0 || window.outerWidth === 0;
    const minimized = zeroed && lastKnownGoodSize;
    bus.emit(minimized ? "browser_minimized" : "tab_switch", { visibilityState: "hidden" });
  }

  function handleVisible() {
    if (document.visibilityState === "visible" && window.outerWidth > 0 && window.outerHeight > 0) {
      lastKnownGoodSize = true;
    }
  }

  function handleBlur() {
    if (document.visibilityState === "hidden" || withinGrace()) return;
    bus.emit("focus_loss");
  }

  function handleFullscreenChange() {
    if (document.fullscreenElement) {
      fullscreenEntered = true;
      callbacks.onFullscreenEnter?.();
    } else if (fullscreenEntered) {
      fullscreenEntered = false;
      if (withinGrace()) return;
      bus.emit("fullscreen_exit");
      callbacks.onFullscreenExit?.();
    }
  }

  function handleOffline() {
    if (withinGrace()) return;
    bus.emit("connectivity_interruption", { state: "offline" });
  }

  document.addEventListener("visibilitychange", handleVisibility);
  document.addEventListener("visibilitychange", handleVisible);
  document.addEventListener("fullscreenchange", handleFullscreenChange);
  window.addEventListener("blur", handleBlur);
  window.addEventListener("offline", handleOffline);

  return () => {
    document.removeEventListener("visibilitychange", handleVisibility);
    document.removeEventListener("visibilitychange", handleVisible);
    document.removeEventListener("fullscreenchange", handleFullscreenChange);
    window.removeEventListener("blur", handleBlur);
    window.removeEventListener("offline", handleOffline);
  };
}

export async function requestFullscreenReentry(): Promise<void> {
  if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
}
