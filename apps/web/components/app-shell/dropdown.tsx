"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";

import styles from "./app-shell.module.css";

/**
 * `@app/ui` exports no `DropdownMenu`/`Popover` (only `Dialog`/`Drawer`) and `apps/web` has no
 * direct `@radix-ui/react-dropdown-menu` dependency of its own — adding one means editing a
 * `package.json`, out of scope. This is the same hand-rolled WAI-ARIA menu-button subset
 * `components/marketing/site/nav-dropdown.tsx` already implements for the identical constraint:
 * `aria-haspopup`/`aria-expanded` on the trigger, `role="menu"` on the panel, arrow-key/Home/End
 * roving focus, Escape and outside-click to close, focus restored to the trigger on close. A
 * separate, app-shell-owned copy rather than importing the marketing one — chrome under `(app)/`
 * shouldn't depend on a `(marketing)/`-owned component.
 */
export interface DropdownProps {
  triggerLabel: ReactNode;
  triggerClassName?: string;
  panelClassName?: string;
  align?: "start" | "end";
  children: ReactNode;
}

export function Dropdown({
  triggerLabel,
  triggerClassName,
  panelClassName,
  align = "end",
  children,
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const reactId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  useEffect(() => {
    if (open) panelRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, [open]);

  function menuItems(): HTMLElement[] {
    return Array.from(panelRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
  }

  function moveFocus(delta: number) {
    const items = menuItems();
    if (items.length === 0) return;
    const current = items.indexOf(document.activeElement as HTMLElement);
    const next = (current + delta + items.length) % items.length;
    items[next]?.focus();
  }

  function close(restoreFocus: boolean) {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }

  function handleTriggerKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setOpen(true);
    } else if (event.key === "Escape" && open) {
      close(true);
    }
  }

  function handlePanelKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        moveFocus(1);
        break;
      case "ArrowUp":
        event.preventDefault();
        moveFocus(-1);
        break;
      case "Home":
        event.preventDefault();
        menuItems()[0]?.focus();
        break;
      case "End":
        event.preventDefault();
        menuItems().at(-1)?.focus();
        break;
      case "Escape":
        event.preventDefault();
        close(true);
        break;
      case "Tab":
        close(false);
        break;
      default:
        break;
    }
  }

  const triggerId = `${reactId}-trigger`;
  const panelId = `${reactId}-panel`;

  return (
    <div className={styles.dropdownRoot}>
      <button
        ref={triggerRef}
        type="button"
        id={triggerId}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={panelId}
        className={triggerClassName}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={handleTriggerKeyDown}
      >
        {triggerLabel}
      </button>
      {open ? (
        <div
          ref={panelRef}
          id={panelId}
          role="menu"
          aria-labelledby={triggerId}
          onKeyDown={handlePanelKeyDown}
          className={`${styles.dropdownPanel} absolute z-30 mt-2 min-w-52 rounded-md p-1.5 ${
            align === "end" ? "right-0" : "left-0"
          } ${panelClassName ?? ""}`}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

/** Contract: any element passed as menu content must carry `role="menuitem"` + `tabIndex={-1}`. */
export function dropdownItemClassName(extra?: string): string {
  return `${styles.dropdownItem} block w-full rounded px-3 py-2 text-left text-sm outline-none ${extra ?? ""}`;
}
