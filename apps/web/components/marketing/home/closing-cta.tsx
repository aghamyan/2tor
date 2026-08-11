import Link from "next/link";
import { headerButtonClass } from "../site/header-actions";
import { ArrowUpRightIcon } from "../site/icons";
import siteStyles from "../site/site.module.css";
import type { Cta } from "./content";
import { Reveal } from "./reveal";
import { ParallaxField } from "./parallax-field";
import styles from "./compact-home.module.css";

export interface ClosingCtaCopy {
  title: string;
  description: string;
  /** The reassurance line under the buttons — what the consultation costs, and what it commits to. */
  note: string;
}

export interface ClosingCtaProps {
  copy: ClosingCtaCopy;
  consultationCta: Cta;
  pricingCta: Cta;
}

/**
 * The page's closing band: the last thing above the layout's footer.
 *
 * It reuses `.groupSection`'s treatment rather than inventing a closing one, so the page ends on a
 * room it has already been in: the same pine fill and the same refractive field of a ruled grid
 * plus three blurred blooms, re-aimed at a centred column (see the CSS).
 *
 * The headline deliberately does NOT run through the hero's `splitAccent`/`.heroAccentWord`
 * underline. That rule is the hero's signature; drawing it twice on one page spends it.
 */
export function ClosingCta({ copy, consultationCta, pricingCta }: ClosingCtaProps) {
  return (
    <section className={styles.closingSection} aria-labelledby="home-closing-title">
      <ParallaxField className={styles.closingField} distance={28}>
        <span className={styles.closingGrid} />
        <span className={styles.closingBloomOne} />
        <span className={styles.closingBloomTwo} />
        <span className={styles.closingBloomThree} />
      </ParallaxField>

      <div className={styles.sectionShell}>
        {/*
         * `fade={false}` because this block contains the page's two closing buttons. A reveal that
         * animates from `opacity: 0` would leave them focusable-but-invisible for anyone tabbing
         * ahead of the scroll — the exact failure `scroll-reveal.tsx` was written to avoid. The
         * rise alone still reads as an entrance.
         */}
        <Reveal fade={false} className={styles.closingInner}>
          <h2 className={styles.closingTitle} id="home-closing-title">
            {copy.title}
          </h2>
          <p className={styles.closingLede}>{copy.description}</p>

          <div className={styles.closingActions}>
            {/*
             * The same button the header and the hero render — `siteStyles.buttonPrimary` plus
             * `headerButtonClass` — so the accent pill, its travelling sheen, the arrow and the
             * destination stay in sync with those two by construction.
             *
             * `.scope` must come along: it is where `site.module.css` declares the `--site-*`
             * tokens `.buttonPrimary` paints with, and outside the site chrome they would
             * otherwise resolve to nothing and leave bare text. See `hero.tsx` for the same note.
             */}
            <Link
              href={consultationCta.href}
              className={`${siteStyles.scope} ${siteStyles.buttonPrimary} ${headerButtonClass} ${styles.closingPrimaryAction}`}
            >
              {consultationCta.label}
              <ArrowUpRightIcon className={siteStyles.buttonIcon} />
            </Link>
            <Link href={pricingCta.href} className={styles.closingSecondaryAction}>
              {pricingCta.label}
            </Link>
          </div>

          <p className={styles.closingNote}>{copy.note}</p>
        </Reveal>
      </div>
    </section>
  );
}
