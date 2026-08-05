"use client";

import type { SignalBus } from "./signal-bus";

/**
 * Blocks copy/cut/paste, the right-click context menu, and dragging content out of the assessment
 * container (spec §7-10). Scoped to a container ref rather than `document` so answer inputs still
 * behave like normal form controls for assistive technology (focus, native selection for editing)
 * while the surrounding question content is locked down.
 */
export function installClipboardGuard(container: HTMLElement, bus: SignalBus): () => void {
  function blockClipboard(eventType: "copy_attempt" | "paste_attempt" | "cut_attempt") {
    return (domEvent: ClipboardEvent) => {
      domEvent.preventDefault();
      bus.emit(eventType);
    };
  }
  function blockContextMenu(domEvent: MouseEvent) {
    domEvent.preventDefault();
    bus.emit("context_menu_attempt");
  }
  function blockDrag(domEvent: DragEvent) {
    domEvent.preventDefault();
    bus.emit("drag_attempt");
  }

  const onCopy = blockClipboard("copy_attempt");
  const onPaste = blockClipboard("paste_attempt");
  const onCut = blockClipboard("cut_attempt");

  container.addEventListener("copy", onCopy);
  container.addEventListener("paste", onPaste);
  container.addEventListener("cut", onCut);
  container.addEventListener("contextmenu", blockContextMenu);
  container.addEventListener("dragstart", blockDrag);
  container.addEventListener("drop", blockDrag);

  return () => {
    container.removeEventListener("copy", onCopy);
    container.removeEventListener("paste", onPaste);
    container.removeEventListener("cut", onCut);
    container.removeEventListener("contextmenu", blockContextMenu);
    container.removeEventListener("dragstart", blockDrag);
    container.removeEventListener("drop", blockDrag);
  };
}
