"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

/**
 * Entrance reveal for section copy: a short rise with a fade, staggered by `index`.
 *
 * TWO constraints shape this, and neither is negotiable:
 *
 * 1. `initial` is NOT branched on `reduceMotion` — only `transition` is. `useReducedMotion()`
 *    reads a media query, so it is `false` during SSR and `true` on a reduced-motion client.
 *    Branching a prop that renders inline styles ships different `style` attributes from the
 *    server and the client and React reports a hydration mismatch. `transition` renders no markup,
 *    so collapsing the duration there kills the motion without touching the HTML. This is the
 *    convention every motion element in `compact-home.tsx` already follows.
 *
 * 2. `fade` defaults to true but MUST be turned off for anything containing a link or a button.
 *    `scroll-reveal.tsx` records why: an unrevealed block that animates from `opacity: 0` leaves
 *    its links focusable-but-invisible for a keyboard user tabbing ahead of the scroll position.
 *    With `fade={false}` only `transform` animates, so the content is always readable and its
 *    focus ring always visible, and the reveal still reads as motion.
 */
export function Reveal({
  children,
  index = 0,
  fade = true,
  className,
}: {
  children: ReactNode;
  index?: number;
  /** Set false whenever the subtree contains focusable content. See note 2 above. */
  fade?: boolean;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={{ opacity: fade ? 0 : 1, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={
        reduceMotion
          ? { duration: 0 }
          : { type: "spring", bounce: 0, duration: 0.55, delay: index * 0.07 }
      }
    >
      {children}
    </motion.div>
  );
}
