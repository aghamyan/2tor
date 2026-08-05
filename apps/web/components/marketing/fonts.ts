import { Atkinson_Hyperlegible, Instrument_Sans, Noto_Sans_Armenian } from "next/font/google";

/**
 * Type stack for the public surfaces, ported from `landing/styles.css`.
 *
 * Loaded through `next/font/google`, which self-hosts the files and emits a
 * `size-adjust` fallback — the landing page's `<link>` to fonts.googleapis.com was
 * a documented piece of its technical debt, and this closes it rather than
 * carrying it over.
 *
 * Weights match exactly what the landing page requests, which is also all that
 * Google publishes for these families: Instrument Sans ships 400–700, Atkinson
 * Hyperlegible ships only 400 and 700 (no 500/600 — asking for one is a build
 * error, not a silent fallback).
 *
 * `Noto Sans Armenian` is exposed as its own variable and sits second in both
 * stacks in `app/globals.css`. Neither Latin face has Armenian coverage, and `hy`
 * is a first-class locale here, so without it Armenian copy falls back to an
 * arbitrary system face mid-sentence.
 */
export const displayFont = Instrument_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--vz-font-display",
});

export const bodyFont = Atkinson_Hyperlegible({
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
  variable: "--vz-font-body",
});

export const armenianFont = Noto_Sans_Armenian({
  subsets: ["armenian", "latin"],
  weight: "variable",
  display: "swap",
  variable: "--vz-font-armenian",
});

/** Class list that declares all three font variables. Apply once, at the layout root. */
export const marketingFontVariables = [
  displayFont.variable,
  bodyFont.variable,
  armenianFont.variable,
].join(" ");
