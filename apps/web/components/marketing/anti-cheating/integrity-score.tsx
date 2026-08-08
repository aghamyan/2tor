"use client";

import { Info } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { IntegrityCategoryScore } from "./types";
import styles from "./anti-cheating-page.module.css";

const ease = [0.22, 1, 0.36, 1] as const;

/**
 * Counts up to `target` once, respecting reduced motion. Deterministic — no easing randomness.
 *
 * Always starts from 0 and only ever calls `setValue` from inside the `requestAnimationFrame`
 * callback, never synchronously in the effect body. Both points matter: `useReducedMotion()` is
 * `null` during SSR but can already be `true` on the client's very first paint, so an early return
 * that renders `target` directly (skipping state) produced a real server/client hydration
 * mismatch here — the fix is to let every path, including reduced motion, resolve through one
 * rAF tick (duration 0 collapses it to a single immediate jump) so the pre-hydration render is
 * always 0 on both sides.
 */
function useCountUp(target: number, active: boolean, reduceMotion: boolean | null) {
  const [value, setValue] = useState(0);
  const frame = useRef(0);

  useEffect(() => {
    if (!active) return;
    const durationMs = reduceMotion ? 0 : 900;
    const start = performance.now();
    function tick(now: number) {
      const progress = durationMs === 0 ? 1 : Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
      if (progress < 1) frame.current = requestAnimationFrame(tick);
    }
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [active, target, reduceMotion]);

  return value;
}

export interface IntegrityScoreProps {
  heading: string;
  score: number;
  ratingLabel: string;
  categories: IntegrityCategoryScore[];
  tooltip: string;
}

export function IntegrityScore({
  heading,
  score,
  ratingLabel,
  categories,
  tooltip,
}: IntegrityScoreProps) {
  const reduceMotion = useReducedMotion();
  const [showTooltip, setShowTooltip] = useState(false);
  const displayScore = useCountUp(score, true, reduceMotion);

  return (
    <div className={styles.integrityCard}>
      <div className={styles.integrityHead}>
        <h3>{heading}</h3>
        <span className={styles.integrityInfo}>
          <button
            type="button"
            aria-describedby="integrity-score-tooltip"
            onClick={() => setShowTooltip((current) => !current)}
            onBlur={() => setShowTooltip(false)}
            className={styles.integrityInfoButton}
          >
            <Info size={15} aria-hidden="true" />
            <span className={styles.srOnly}>What does this score mean?</span>
          </button>
          {showTooltip && (
            <motion.span
              id="integrity-score-tooltip"
              role="tooltip"
              className={styles.integrityTooltip}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={reduceMotion ? { duration: 0 } : { duration: 0.18, ease }}
            >
              {tooltip}
            </motion.span>
          )}
        </span>
      </div>

      <div className={styles.integrityScoreRow}>
        <span className={styles.integrityValue}>{displayScore}</span>
        <span className={styles.integrityRating}>{ratingLabel}</span>
      </div>

      <ul className={styles.integrityCategories}>
        {categories.map((category, index) => (
          <li key={category.key}>
            <span className={styles.integrityCategoryLabel}>{category.label}</span>
            <span className={styles.integrityBar} aria-hidden="true">
              <motion.span
                initial={{ scaleX: 0 }}
                whileInView={{ scaleX: category.value / 100 }}
                viewport={{ once: true, amount: 0.6 }}
                transition={
                  reduceMotion ? { duration: 0 } : { duration: 0.7, delay: index * 0.08, ease }
                }
              />
            </span>
            <span className={styles.integrityCategoryValue}>{category.value}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
