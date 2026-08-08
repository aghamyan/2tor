"use client";

import { useId, useState } from "react";
import { Star } from "lucide-react";

import styles from "./rating-dialog.module.css";

const VALUES = [1, 2, 3, 4, 5] as const;

/**
 * WAI-ARIA "radio group" rating pattern: five `role="radio"` buttons in one `role="radiogroup"`,
 * roving tabindex (only the checked star is tab-stoppable), Left/Right/Up/Down move and select in
 * one step, Home/End jump to 1/5. Controlled — the caller owns `value` — so anything that needs to
 * react to the current rating (e.g. "feedback required below 3 stars") can, instead of this
 * component hiding the live value in its own private state. The numeric value also submits via a
 * hidden input, so this still works inside a plain `<form>` with no submit handling of its own.
 */
export function StarRatingInput({
  name,
  value,
  onChange,
  label,
}: {
  name: string;
  value: number;
  onChange: (value: number) => void;
  label: string;
}) {
  const [focusIndex, setFocusIndex] = useState(value > 0 ? value - 1 : 0);
  const groupId = useId();

  function move(nextIndex: number) {
    const clamped = Math.min(4, Math.max(0, nextIndex));
    setFocusIndex(clamped);
    onChange(clamped + 1);
    const button = document.getElementById(`${groupId}-${clamped}`);
    button?.focus();
  }

  return (
    <div>
      <input type="hidden" name={name} value={value} />
      <div role="radiogroup" aria-label={label} className={styles.starGroup}>
        {VALUES.map((star, index) => (
          <button
            key={star}
            id={`${groupId}-${index}`}
            type="button"
            role="radio"
            aria-checked={value === star}
            aria-label={String(star)}
            tabIndex={index === focusIndex ? 0 : -1}
            className={styles.starButton}
            onClick={() => {
              onChange(star);
              setFocusIndex(index);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowRight" || event.key === "ArrowUp") {
                event.preventDefault();
                move(index + 1);
              } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
                event.preventDefault();
                move(index - 1);
              } else if (event.key === "Home") {
                event.preventDefault();
                move(0);
              } else if (event.key === "End") {
                event.preventDefault();
                move(4);
              }
            }}
          >
            <Star size={22} aria-hidden="true" fill={star <= value ? "currentColor" : "none"} />
          </button>
        ))}
      </div>
    </div>
  );
}
