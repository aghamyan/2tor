"use client";

import { motion, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion";
import { useRef, type ReactNode } from "react";

/**
 * Scroll-linked depth for a section's decorative field.
 *
 * Every section on this page already renders an `aria-hidden` field — a ruled ground plus two or
 * three colour blooms — behind its content. Until now those layers were welded to the page: the
 * only motion on the page was one identical entrance reveal fired six times, which is the thing
 * that reads as "template". Parallax is the honest fix, because these layers are ALREADY
 * background: giving them a different scroll rate is what turns a flat stack of sections into a
 * page with depth, and it costs no new elements and no new colour.
 *
 * ── What is animated, and what is deliberately not ────────────────────────────
 *
 * Only the decorative field moves. Content never does. A headline that drifts against its own
 * section is the reason scroll parallax has a bad name, and it makes text harder to read at
 * exactly the moment someone is trying to read it. `aria-hidden` layers are the whole scope.
 *
 * ── Why a spring sits between scroll and transform ────────────────────────────
 *
 * `useScroll` emits a value that tracks the scroll position exactly, and mapping it straight to a
 * transform produces motion that stops dead the instant the wheel stops. Real depth has mass. The
 * spring smooths the handoff so the layer settles a beat after the scroll does, which is Apple's
 * point about motion inheriting velocity rather than being driven frame-by-frame.
 *
 * `damping`/`stiffness` here are the critically-damped end of that guidance: no overshoot, because
 * a background that bounces past its resting position is a background you have started to notice.
 *
 * ── Performance ──────────────────────────────────────────────────────────────
 *
 * `y` is written as a transform on a `position: absolute` layer that paints nothing but gradients,
 * so it stays on the compositor. `useScroll` with a `target` uses IntersectionObserver-backed
 * measurement rather than a scroll listener, so an off-screen section costs nothing.
 */
export function ParallaxField({
  children,
  className,
  /**
   * How far the layer travels across the section's full pass through the viewport, in pixels.
   * Positive moves the layer DOWN as the page scrolls up, i.e. the layer appears to lag behind the
   * content in front of it, which is what reads as "further away".
   *
   * Keep these small. Past roughly 80px the field visibly slides against its own section edges and
   * the blooms start leaving the box they were positioned in.
   */
  distance = 48,
}: {
  children: ReactNode;
  className?: string;
  distance?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  /*
   * `["start end", "end start"]` measures from the moment the section's top reaches the bottom of
   * the viewport to the moment its bottom leaves the top — the section's entire visible life, so
   * the layer is always mid-travel while on screen rather than finishing early and sitting still.
   */
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const smoothed = useSpring(scrollYProgress, { stiffness: 90, damping: 26, mass: 0.5 });

  /*
   * The reduced-motion branch lives INSIDE the transform, and that is not a style preference — the
   * obvious version is broken.
   *
   * `useReducedMotion()` reads a media query, so it is `false` on the first client render and flips
   * to `true` a tick later. Branching the `style` prop on it (`style={reduceMotion ? undefined :
   * { y }}`) therefore lets Framer write a transform during that first tick, and handing it
   * `undefined` afterwards does not clear what was already written. Verified in the browser: with
   * `prefers-reduced-motion: reduce` the layer sat permanently at `matrix(1, 0, 0, 1, 0, -54)` —
   * not animating, but parked at the start of an animation it was never supposed to run.
   *
   * Keeping `style={{ y }}` constant and zeroing the OUTPUT means the motion value is always the
   * thing in charge, so when the query resolves the layer returns to 0 like any other update.
   *
   * Zero rather than a shortened distance: this is ambient background drift carrying no
   * information, and the right reduced-motion answer for pure decoration is none of it.
   */
  const y = useTransform(smoothed, (progress) =>
    reduceMotion ? 0 : -distance + progress * distance * 2,
  );

  return (
    <motion.div ref={ref} className={className} aria-hidden="true" style={{ y }}>
      {children}
    </motion.div>
  );
}
