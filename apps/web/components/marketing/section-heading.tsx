import type { ReactNode } from "react";
import styles from "./section-heading.module.css";

/** Which ground the opener sits on. Picks the register, not a colour — see the module's note. */
export type SectionTone = "paper" | "pine";

/**
 * The short label above a section heading: an accent rule, then the name of the section.
 *
 * Rendered as a `<p>`, never a heading element. It labels the section for a reader but must not
 * enter the document outline — the `<h2>` beneath it is the section's actual heading, and a second
 * heading-shaped element above it would announce every section twice to a screen reader.
 */
export function SectionEyebrow({
  children,
  tone = "paper",
  className,
}: {
  children: ReactNode;
  tone?: SectionTone;
  className?: string;
}) {
  return (
    <p className={`${styles.eyebrow}${className ? ` ${className}` : ""}`} data-tone={tone}>
      {children}
    </p>
  );
}

/**
 * Wraps the accent run of a headline in a coloured span, leaving the rest as plain text.
 *
 * Returns the untouched string when the run is absent, so a copy edit that loses the phrase costs
 * the colour and nothing else — never a headline with a hole in it. That matters most in `hy`,
 * where the translated phrase often sits at a different position in the sentence than the English
 * one and is the likeliest thing to fall out of sync.
 *
 * Accent placement follows MEANING, not position: `parents` accents the end of its sentence in
 * English and the start of it in Armenian, because that is where the same idea lands in each.
 */
export function accentedTitle(title: string, accent: string, tone: SectionTone = "paper") {
  const at = accent ? title.indexOf(accent) : -1;
  if (at === -1) return title;
  return (
    <>
      {title.slice(0, at)}
      <span className={styles.accent} data-tone={tone}>
        {accent}
      </span>
      {title.slice(at + accent.length)}
    </>
  );
}
