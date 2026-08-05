"use client";

import type { SignalBus } from "./signal-bus";
import type { AssessmentEventType } from "../../../../../packages/domain/assessments/models";

/**
 * Best-effort keyboard interception (spec §6). `preventDefault` on these combos stops the
 * default browser action in most desktop browsers, but a browser or OS can always ignore it —
 * this discourages and logs, it does not guarantee prevention (see README "Camera boundary" and
 * the module's own privacy notice).
 *
 * Copy/paste/cut are deliberately NOT handled here — only `clipboard-guard.ts`'s `copy`/`paste`/
 * `cut` DOM event listeners emit those signals. Whether a keydown's `preventDefault` also
 * suppresses the browser's paired clipboard event is inconsistent across browsers; intercepting
 * both layers risked either a duplicate signal (double-counting suspicion points) or, worse,
 * silently swallowing the clipboard event entirely and losing the block. The clipboard event is
 * the one reliable, single source of truth for those three.
 */
interface ShortcutRule {
  key: string;
  requiresShift?: boolean;
  requiresAlt?: boolean;
  eventType: AssessmentEventType;
  combo: string;
}

const isApplePlatform = () =>
  typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);

// Windows/Linux devtools shortcuts use Ctrl+Shift+<key>; macOS uses Cmd+Option+<key>.
const RULES: ShortcutRule[] = [
  { key: "i", requiresShift: true, eventType: "devtools_shortcut", combo: "inspect" },
  { key: "j", requiresShift: true, eventType: "devtools_shortcut", combo: "console" },
  { key: "c", requiresShift: true, eventType: "devtools_shortcut", combo: "inspect-element" },
  { key: "u", eventType: "view_source_attempt", combo: "view-source" },
  { key: "s", eventType: "save_attempt", combo: "save-page" },
  { key: "p", eventType: "print_attempt", combo: "print" },
  { key: "a", eventType: "select_all_attempt", combo: "select-all" },
];

export function installShortcutGuard(bus: SignalBus): () => void {
  function handleKeydown(domEvent: KeyboardEvent) {
    const key = domEvent.key.toLowerCase();

    if (key === "f12") {
      domEvent.preventDefault();
      bus.emit("devtools_shortcut", { combo: "F12" });
      return;
    }

    const isMac = isApplePlatform();
    const primaryModifier = isMac ? domEvent.metaKey : domEvent.ctrlKey;
    if (!primaryModifier) return;
    // macOS devtools shortcuts add Option instead of Shift; treat either as the "modified" combo.
    const modified = isMac ? domEvent.altKey : domEvent.shiftKey;

    const rule = RULES.find(
      (candidate) => candidate.key === key && Boolean(candidate.requiresShift) === modified,
    );
    if (!rule) return;
    domEvent.preventDefault();
    bus.emit(rule.eventType, { combo: rule.combo });
  }

  window.addEventListener("keydown", handleKeydown, true);
  return () => window.removeEventListener("keydown", handleKeydown, true);
}
