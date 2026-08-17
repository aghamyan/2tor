"use client";

import { motion, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Scroll-linked drift for a block of CONTENT, not a decorative layer.
 *
 * `ParallaxField` next to this one states the opposite rule — only the aria-hidden field moves,
 * content never does — and that rule is still right for the field. This is the deliberate
 * exception, and it exists because of a specific shape: a two-column section whose visual is half a
 * screen tall and whose copy is a third of that. The column has real slack in it, and the choice is
 * to leave the copy parked in the middle of a hole or to let the slack become travel.
 *
 * Three things keep it readable, which is the whole objection to moving text:
 *
 *   the travel is MEASURED, never guessed. It is exactly the slack between the block and the row it
 *   sits in, so the block cannot drift past its own column or collide with anything;
 *
 *   the spring means the block settles a beat after the scroll stops rather than tracking the wheel
 *   frame for frame — so the moment a reader stops to read, the text stops too;
 *
 *   the rate is low. The block covers its own slack across the section's entire pass through the
 *   viewport, which is well over a screen of scrolling.
 *
 * ── The two-element split is required ────────────────────────────────────────
 *
 * The outer div is measured; the inner one moves. They cannot be the same element: `useScroll`
 * reads a bounding rect, and a rect that includes the transform this component is writing would
 * feed its own output back into its input. The outer div never transforms, so progress stays a
 * function of the page's scroll and nothing else.
 */
export function ScrollDrift({ children, className }: { children: ReactNode; className?: string }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const [travel, setTravel] = useState(0);

  /*
   * Slack is the difference between the row the block was given and the block itself. It has to be
   * observed rather than computed once: it changes with viewport width, and it changes with locale
   * — `hy` sets this section's headline longer, which leaves less room to move.
   *
   * Capped, because slack is not the same thing as a good distance. Past roughly a fifth of a
   * screen the drift stops reading as depth and starts reading as the layout being unfinished.
   */
  useEffect(() => {
    const outerEl = outer.current;
    const innerEl = inner.current;
    if (!outerEl || !innerEl) return;
    const measure = () => {
      setTravel(Math.max(0, Math.min(outerEl.clientHeight - innerEl.offsetHeight, 280)));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(outerEl);
    observer.observe(innerEl);
    return () => observer.disconnect();
  }, []);

  const { scrollYProgress } = useScroll({ target: outer, offset: ["start end", "end start"] });
  const smoothed = useSpring(scrollYProgress, { stiffness: 90, damping: 26, mass: 0.5 });

  /*
   * The reduced-motion branch lives INSIDE the transform for the same reason it does in
   * `ParallaxField`: `useReducedMotion()` reads a media query, so it is false on the first client
   * render and flips a tick later. Branching the `style` prop instead lets Framer write a transform
   * during that tick, and handing it `undefined` afterwards does not clear what was already there.
   *
   * The reduced-motion resting place is the middle of the slack, not the top. There is no "finished
   * state" for a link to a scroll position, so the honest static answer is where the block reads
   * best — which is centred in the space it was given, exactly where it sat before this existed.
   */
  const y = useTransform(smoothed, (progress) =>
    reduceMotion ? travel / 2 : progress * travel,
  );

  return (
    <div ref={outer} className={className}>
      <motion.div ref={inner} style={{ y }}>
        {children}
      </motion.div>
    </div>
  );
}
