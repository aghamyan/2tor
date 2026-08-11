import Link from "next/link";
import { ArrowRight, CalendarClock, MessageSquareText, ShieldCheck, Users } from "lucide-react";
import { headerButtonClass } from "../site/header-actions";
import { ArrowUpRightIcon } from "../site/icons";
import siteStyles from "../site/site.module.css";
import { ClassroomPreview, type ClassroomCopy } from "./compact-home";
import { ParallaxField } from "./parallax-field";
import styles from "./compact-home.module.css";

export interface HeroProps {
  titleLead: string;
  titleAccent: string;
  /** The four differentiators that replaced the hero paragraph. Order matches `differentiatorIcons`. */
  differentiators: readonly string[];
  consultationCta: { label: string; href: string };
  coursesCta: { label: string; href: string };
  classroom: ClassroomCopy;
}

/*
 * Positional, because the copy record supplies plain strings and the four points are a fixed,
 * authored set rather than open-ended data. Adding a fifth means adding an icon here, which is the
 * right amount of friction for a hero.
 */
const differentiatorIcons = [ShieldCheck, Users, CalendarClock, MessageSquareText] as const;

/**
 * Splits the accent phrase into "everything before the last word", "the last word", and any
 * trailing punctuation.
 *
 * The underline is drawn on the last word alone and has to measure exactly that word on every
 * viewport, so the word needs its own inline-block box — an absolutely positioned rule inside the
 * whole accent span resolves against a fragmented containing block the moment the phrase wraps,
 * which is why its width used to drift with the breakpoint.
 *
 * `\p{P}` rather than a hand-written character class: Armenian's վերջակետ (`։`, U+0589) is visually
 * identical to a colon, and a mistyped lookalike would silently leave it inside the underline.
 */
function splitAccent(accent: string) {
  const trimmed = accent.trim();
  const punctuation = /\p{P}+$/u.exec(trimmed)?.[0] ?? "";
  const words = trimmed.slice(0, trimmed.length - punctuation.length);
  const boundary = words.lastIndexOf(" ");
  return {
    lead: boundary === -1 ? "" : words.slice(0, boundary + 1),
    word: boundary === -1 ? words : words.slice(boundary + 1),
    punctuation,
  };
}

/** The headline and primary actions stay server-rendered; only the product demo hydrates. */
export function Hero({
  titleLead,
  titleAccent,
  differentiators,
  consultationCta,
  coursesCta,
  classroom,
}: HeroProps) {
  const { lead, word, punctuation } = splitAccent(titleAccent);

  return (
    <section className={styles.hero} aria-labelledby="home-title">
      {/* Two decorative glyphs (`Ա` and `{ }`) used to sit in here. See the note where their rules
          were in `compact-home.module.css` for why the hero is better with three background layers
          than five. */}
      <ParallaxField className={styles.heroBackdrop} distance={60}>
        <span className={styles.heroGrid} />
        <span className={styles.pathLine} />
      </ParallaxField>

      <div className={styles.heroShell}>
        <div className={styles.heroLayout}>
          <div className={styles.heroCopy}>
            <h1 id="home-title" className={styles.heroTitle}>
              {titleLead}{" "}
              <span className={styles.heroAccent}>
                {lead}
                <span className={styles.heroAccentWord}>
                  {word}
                  <i aria-hidden="true" />
                </span>
                {punctuation}
              </span>
            </h1>
            <ul className={styles.heroPoints}>
              {differentiators.map((point, index) => {
                const Icon = differentiatorIcons[index] ?? ShieldCheck;
                return (
                  <li key={point}>
                    <Icon size={17} aria-hidden="true" />
                    {point}
                  </li>
                );
              })}
            </ul>

            <div className={styles.heroActions}>
              {/*
               * Deliberately the header's own button, not a copy of it: `headerButtonClass` and
               * `.buttonPrimary` are the exact two classes `HeaderActionsPanel` composes, so the
               * accent pill, the travelling sheen, the arrow and the destination all stay in sync
               * by construction.
               *
               * `.scope` has to come along. It is where `site.module.css` declares the
               * `--site-*` tokens `.buttonPrimary` paints with, and outside the site chrome —
               * which is exactly where this hero sits — they would otherwise resolve to nothing
               * and the button would render as bare text.
               */}
              <Link
                href={consultationCta.href}
                className={`${siteStyles.scope} ${siteStyles.buttonPrimary} ${headerButtonClass} ${styles.heroConsultAction}`}
              >
                {consultationCta.label}
                <ArrowUpRightIcon className={siteStyles.buttonIcon} />
              </Link>
              <Link href={coursesCta.href} className={styles.secondaryAction}>
                {coursesCta.label}
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
            </div>
          </div>

          <ClassroomPreview copy={classroom} />
        </div>
      </div>
    </section>
  );
}
