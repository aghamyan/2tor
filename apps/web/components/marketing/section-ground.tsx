"use client";

import { ParallaxField } from "./parallax-field";
import styles from "./section-ground.module.css";

/**
 * The decorative field behind a section: a ruled ground plus optional colour blooms, drifting at its
 * own scroll rate.
 *
 * Shared by the home page and `/how-it-works` so the two cannot drift. What lives here is
 * everything that must be identical — the grid's cell size and alpha, the blooms' shape and blur,
 * the parallax behaviour, and the fact that the whole thing is `aria-hidden`. What each caller keeps
 * is composition: where its blooms sit, what colour they are, and where the ruling is anchored.
 *
 * TONE picks the register rather than a colour. `paper` draws ink hairlines for the light sections;
 * `pine` draws them in the block's own foreground, because ink on pine is invisible. Passing the
 * wrong one is the one mistake that shows immediately, so it is a required prop rather than a
 * default.
 */
export function SectionGround({
  tone,
  mask,
  parallax = 44,
  blooms = [],
}: {
  tone: "paper" | "pine";
  /**
   * A CSS `mask-image` value anchoring the ruling under this section's centre of gravity. Every
   * section fades its grid out before it reaches text; where it fades from is a composition choice,
   * which is why it is per-caller rather than fixed here.
   */
  mask?: string;
  /** Scroll travel in pixels. Keep small — past ~80px the blooms leave the box they were placed in. */
  parallax?: number;
  /**
   * Positioning classes for this section's blooms, from the caller's own module. Each is combined
   * with the shared `.bloom`, which owns only the shape and the blur radius — a bloom with a
   * different blur reads as a different material, and the field's whole job is that every section is
   * lit the same way.
   */
  blooms?: readonly string[];
}) {
  return (
    <ParallaxField
      className={styles.ground}
      distance={parallax}
      style={mask ? ({ "--ground-mask": mask } as React.CSSProperties) : undefined}
      data-tone={tone}
    >
      <span className={styles.grid} />
      {blooms.map((bloom) => (
        <span key={bloom} className={`${styles.bloom} ${bloom}`} />
      ))}
    </ParallaxField>
  );
}
