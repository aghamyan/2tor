"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@app/ui";

import styles from "./logout.module.css";

/**
 * Thin wrapper around `@app/ui`'s Radix-backed `Dialog` — accessibility (focus trap, ESC to
 * close, focus restored to the trigger on close) comes from Radix for free; this file only adds
 * the copy layout and this task's own visual styling (see `logout.module.css`'s file-level note
 * on why that can't lean on `@app/ui`'s own Tailwind classes here).
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  busy,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  busy: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${styles.root} ${styles.dialogContent}`} showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className={styles.dialogDescription}>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <button
            type="button"
            className={styles.button}
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`${styles.button} ${styles.buttonDanger}`}
            disabled={busy}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
