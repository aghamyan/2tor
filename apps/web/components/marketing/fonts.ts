import { Atkinson_Hyperlegible, Instrument_Sans, Noto_Sans_Armenian } from "next/font/google";

/**
 * Type stack for the public surfaces, ported from `landing/styles.css`.
 *
 * Loaded through `next/font/google`, which self-hosts the files and emits a
 * `size-adjust` fallback — the landing page's `<link>` to fonts.googleapis.com was
 * a documented piece of its technical debt, and this closes it rather than
 * carrying it over.
 *
 * Instrument Sans is loaded as its VARIABLE face (`wght` 400–700), not as four
 * static instances, and that is a correctness fix rather than a size tweak.
 *
 * With statics, CSS font matching resolves any weight above the heaviest
 * available one down to it. Measured in the browser: at 100px, the advance width
 * of the same string was byte-identical for 640, 650, 700, 720, 750, 780, 800 and
 * 850 — eight declared weights, one rendered face. So `.heroTitle`'s 720 and
 * `.heroPoints`'s 640 were rendering at exactly the same weight, and the home
 * page's carefully graded scale had four real steps, not nine. 520 collapsed onto
 * 600 the same way.
 *
 * On the variable axis every value in 400–700 renders distinctly. Values ABOVE 700
 * still clamp to 700 — the axis maximum — so call sites must stay inside the range
 * for the step to be real. `compact-home.module.css` was remapped accordingly.
 *
 * ── A known limitation of the body face ───────────────────────────────────────
 *
 * Atkinson Hyperlegible has no variable face and ships only 400 and 700. Asking
 * for 500 or 600 is not a build error but it is not a distinct weight either:
 * measured the same way, 400 and 500 render identically, and so do 600 and 700.
 * So every `font-weight: 500` on `--vz-body` text renders at 400 and every 600
 * renders at 700 — which is why the header's "Log in" sits heavier than the nav
 * beside it. The face is kept deliberately (its low-vision legibility is the
 * point), so the fix belongs at the call sites: on body-face text, use only 400
 * and 700 and get intermediate emphasis from size or colour, not from a weight
 * the family cannot draw.
 */
export const displayFont = Instrument_Sans({
  subsets: ["latin"],
  weight: "variable",
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
