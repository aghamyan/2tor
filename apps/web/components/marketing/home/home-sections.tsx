"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  BookOpenCheck,
  CalendarClock,
  Check,
  MessageSquareText,
  Network,
  UserRoundCheck,
  Target,
} from "lucide-react";
import { ParentDashboardPreview } from "../parents/parent-dashboard-preview";
import type { ParentsCopy } from "../parents/parents-content";
import { ParallaxField } from "./parallax-field";
import styles from "./compact-home.module.css";

/**
 * The compact matching map. A deliberately smaller retelling of the full diagram on
 * `/group-lessons` — two students instead of three, no waiting-list branch — because that branch is
 * the group-lessons page's story and this is the home page's one-band summary of it.
 */
export interface GroupMapCopy {
  /** The whole diagram is one `role="img"`, so this sentence is the only thing it announces. */
  ariaLabel: string;
  title: string;
  status: string;
  students: readonly { initials: string; name: string; detail: string; tag: string }[];
  tutorLabel: string;
  result: string;
  criteria: readonly string[];
}

export interface GroupLessonsCopy {
  eyebrow: string;
  title: string;
  /**
   * The run of `title` that carries the accent colour. A substring rather than a split pair so the
   * headline stays one readable sentence in the copy record — and if it ever stops matching, the
   * title still renders whole, just unaccented.
   */
  titleAccent: string;
  body: string;
  points: readonly string[];
  cta: string;
  map: GroupMapCopy;
}

export interface ParentPreviewCopy {
  eyebrow: string;
  title: string;
  /** See `GroupLessonsCopy.titleAccent`. */
  titleAccent: string;
  /**
   * What the parent view gathers, one item per line. This replaced a paragraph that listed the
   * same four things inside a sentence — see the copy record. Order matches `parentPointIcons`
   * below and the workspace mock beside it.
   */
  points: readonly string[];
  cta: string;
  /** One sentence naming what the workspace picture shows. */
  dashboardAriaLabel: string;
}

/**
 * Wraps the accent run of a headline in the coral span, leaving the rest as plain text.
 *
 * Returns the untouched string when the run is absent, so a copy edit that loses the phrase costs
 * the colour and nothing else — never a headline with a hole in it.
 *
 * Exported because the benefits section in `compact-home.tsx` uses the same treatment. Every
 * section heading on this page now carries an accent phrase, and a second copy of this search is
 * how the two would drift apart.
 */
export function accentedTitle(title: string, accent: string, className = styles.groupTitleAccent) {
  const at = accent ? title.indexOf(accent) : -1;
  if (at === -1) return title;
  return (
    <>
      {title.slice(0, at)}
      <span className={className}>{accent}</span>
      {title.slice(at + accent.length)}
    </>
  );
}

/*
 * Positional, matching `copy.points` order and the hero's own `differentiatorIcons` pattern. Four
 * distinct icons rather than four repeated checkmarks: each names a different KIND of thing the
 * parent view surfaces, and a row of identical ticks would throw that distinction away. The group
 * band above deliberately keeps checkmarks — there the points are a list of claims about one offer,
 * so sameness is correct.
 */
const parentPointIcons = [CalendarClock, Target, BookOpenCheck, MessageSquareText] as const;

/**
 * Group lessons, in one band.
 *
 * A filled pine block rather than a third sheet of glass. The subject cards and the benefit cards
 * above it are both glass, and a page whose every section is the same material has no rhythm — this
 * design language marks a brand statement with the solid block (see the teacher's note in the hero),
 * so the two formats alternate down the page instead of repeating.
 */
export function GroupLessonsStrip({ copy, href }: { copy: GroupLessonsCopy; href: string }) {
  const reduceMotion = useReducedMotion();

  return (
    <section className={styles.groupSection} aria-labelledby="group-title">
      {/*
       * The refractive field, same job it does under the subject cards: glass over a flat fill is a
       * tinted div, so the map's panes need something behind them worth bending. Positioned so the
       * two student cards and the hub each sit over a different tint.
       */}
      <ParallaxField className={styles.groupField} distance={34}>
        <span className={styles.groupGrid} />
        <span className={styles.groupBloomOne} />
        <span className={styles.groupBloomTwo} />
        <span className={styles.groupBloomThree} />
      </ParallaxField>

      <div className={styles.sectionShell}>
        <motion.div
          className={styles.groupBlock}
          initial={{ opacity: 0, y: 26 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={reduceMotion ? { duration: 0 } : { type: "spring", bounce: 0, duration: 0.6 }}
        >
          <div className={styles.groupCopy}>
            <p className={styles.groupEyebrow}>{copy.eyebrow}</p>
            <h2 id="group-title">{accentedTitle(copy.title, copy.titleAccent)}</h2>
            <p className={styles.groupBody}>{copy.body}</p>
            <ul className={styles.groupPoints}>
              {copy.points.map((point) => (
                <li key={point}>
                  <Check size={15} aria-hidden="true" />
                  {point}
                </li>
              ))}
            </ul>
            <Link href={href} className={styles.groupCta}>
              {copy.cta}
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>

          <GroupMatchMap copy={copy.map} />
        </motion.div>
      </div>
    </section>
  );
}

/**
 * Two students converging on one tutor.
 *
 * Laid out as three stacked rows — students, wire, hub — rather than as absolutely positioned nodes
 * over a fixed-ratio canvas the way `/group-lessons` does it. That version's SVG carries hardcoded
 * coordinates in a 620x440 viewBox while its cards are placed in percentages, so the two only agree
 * at that one size; at this band's width, and with Armenian's longer labels growing the cards, the
 * curves would leave their anchors. Here the wire is its own fixed-height row spanning exactly the
 * gap, and its endpoints are the horizontal centres of the two halves — correct at every width, in
 * both locales, whatever the cards do.
 *
 * One `role="img"`: a screen reader should hear the sentence this picture makes, not walk two fake
 * student records and a list of invented criteria.
 */
/**
 * Two students on opposite coasts, resolving into one group.
 *
 * This replaced an abstract node diagram — two cards, a dashed wire, a hub. That drawing said
 * "these two were connected" but not the thing the section is actually claiming, which is that
 * geography stops mattering. A real map says it in one glance: a family in California and a family
 * in Maryland, three time zones apart, in the same lesson.
 *
 * The map is real geometry, not a freehand shape — see `us-map.ts` for how it was projected and
 * why it is baked. The pin positions are Glendale, CA and Rockville, MD, the two launch markets
 * `description.txt` names.
 *
 * MOTION. One authored sequence rather than the same entrance repeated: the map fades up, the two
 * pins drop in a beat apart, the arc draws between them, and only then does the result resolve at
 * the meeting point. The order is the argument — you watch two separate places become one match.
 * Springs are critically damped (`bounce: 0`); a background diagram that overshoots is a diagram
 * you have started to notice. Under `prefers-reduced-motion` every step collapses to zero duration,
 * so the final state simply appears.
 *
 * The whole thing is one `role="img"` with a single label. A screen reader should hear the sentence
 * this picture makes, not walk two fake student records, a country outline and a list of criteria.
 */
function GroupMatchMap({ copy }: { copy: GroupMapCopy }) {
  const reduceMotion = useReducedMotion();
  // Gates the dash flow along the wire. CSS can't start on scroll, and the section is far below the
  // fold, so an unconditional keyframe would have finished long before anyone saw it.
  const [live, setLive] = useState(false);

  const rise = (delay: number) =>
    reduceMotion ? { duration: 0 } : { type: "spring" as const, bounce: 0, duration: 0.55, delay };

  return (
    <motion.div
      className={`${styles.groupMap}${live ? ` ${styles.groupMapLive}` : ""}`}
      role="img"
      aria-label={copy.ariaLabel}
      onViewportEnter={() => setLive(true)}
      viewport={{ once: true, amount: 0.4 }}
    >
      <div className={styles.mapHead} aria-hidden="true">
        <span className={styles.mapTitle}>
          <Network size={15} />
          {copy.title}
        </span>
        <span className={styles.mapStatus}>
          <i />
          {copy.status}
        </span>
      </div>

      {/*
       * Each card is a plain element inside a motion wrapper rather than a `motion.article` itself.
       * Framer writes the reveal to the element's inline `transform`, and an inline transform beats
       * a class — put the two on the same node and the CSS hover lift below silently never fires.
       * The wrapper owns the entry, the card owns the hover.
       */}
      <div className={styles.mapStudents} aria-hidden="true">
        {copy.students.map((student, index) => (
          <motion.div
            key={student.name}
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={rise(0.08 + index * 0.1)}
          >
            <article className={styles.mapStudent}>
              <span className={styles.mapAvatar}>{student.initials}</span>
              <div>
                <strong>{student.name}</strong>
                <small>{student.detail}</small>
              </div>
              <span className={styles.mapTag}>{student.tag}</span>
            </article>
          </motion.div>
        ))}
      </div>

      {/*
       * `preserveAspectRatio="none"` so the 0-100 x-axis maps straight onto the row's width: 25 and
       * 75 are then the centres of the two cards at any size. The vertical stretch that buys costs
       * nothing here — these are decorative curves, not a shape anyone reads — and
       * `vector-effect: non-scaling-stroke` keeps the width and the dash lengths honest under it.
       */}
      <motion.svg
        className={styles.mapWire}
        viewBox="0 0 100 40"
        preserveAspectRatio="none"
        aria-hidden="true"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, amount: 0.5 }}
        transition={reduceMotion ? { duration: 0 } : { duration: 0.45, delay: 0.3 }}
      >
        <path d="M25 1 C25 20 50 15 50 39" />
        <path d="M75 1 C75 20 50 15 50 39" />
      </motion.svg>

      <motion.div
        className={styles.mapHubEntry}
        aria-hidden="true"
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.5 }}
        transition={rise(0.4)}
      >
        <div className={styles.mapHub}>
          <span className={styles.mapTutor}>
            <UserRoundCheck size={22} />
          </span>
          <small>{copy.tutorLabel}</small>
          <strong>{copy.result}</strong>
          <div className={styles.mapCriteria}>
            {copy.criteria.map((item) => (
              <span key={item}>
                <Check size={12} />
                {item}
              </span>
            ))}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/**
 * The parent view, summarised.
 *
 * The panel is a STATIC mock, deliberately: `components/dashboards/parent-dashboard.tsx` is the
 * real signed-in surface and it reads live family data through server components, so it cannot be
 * rendered on a public marketing page. This mirrors its shape — the same section tabs as
 * `/parents`, the same four things the Overview panel leads with — with authored sample content.
 */
export function ParentPreviewStrip({
  copy,
  dashboard,
  href,
}: {
  copy: ParentPreviewCopy;
  dashboard: ParentsCopy["dashboard"];
  href: string;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <section className={styles.parentSection} aria-labelledby="parent-title">
      {/* One pane of glass — the eyebrow — still needs something behind it to be glass at all. */}
      <ParallaxField className={styles.parentField} distance={46}>
        <span className={styles.parentGrid} />
        <span className={styles.parentBloomOne} />
        <span className={styles.parentBloomTwo} />
      </ParallaxField>

      <div className={styles.sectionShell}>
        <div className={styles.parentLayout}>
          <div className={styles.parentCopy}>
            <p className={styles.sectionEyebrow}>{copy.eyebrow}</p>
            <h2 id="parent-title">
              {accentedTitle(copy.title, copy.titleAccent, styles.parentTitleAccent)}
            </h2>
            <ul className={styles.parentPoints}>
              {copy.points.map((point, index) => {
                const Icon = parentPointIcons[index] ?? Check;
                return (
                  <li key={point}>
                    <Icon size={17} aria-hidden="true" />
                    {point}
                  </li>
                );
              })}
            </ul>
            <Link href={href} className={styles.parentCta}>
              {copy.cta}
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>

          {/*
           * The real `/parents` workspace preview, not a second sketch of it. The hand-built table
           * that used to sit here showed four rows of the same information the workspace already
           * shows better, and it drifted from the page it was advertising the moment either changed.
           *
           * `role="img"` with the whole picture hidden inside: the component carries an `<h3>`, a
           * `<nav>` landmark and an `id`, all correct on its own page and all noise on a second one.
           * A reader here should hear the one sentence this picture makes.
           */}
          <motion.div
            className={styles.parentPreviewEntry}
            aria-label={copy.dashboardAriaLabel}
            role="img"
            initial={{ opacity: 0, y: 26, scale: 0.97 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={
              reduceMotion ? { duration: 0 } : { type: "spring", bounce: 0, duration: 0.6 }
            }
          >
            {/* Framer owns the wrapper's transform, the inner div owns the display scale — put both
                on one node and the inline `transform: none` it settles on wins, silently. */}
            <div className={styles.parentPreview} aria-hidden="true">
              <ParentDashboardPreview c={dashboard} />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
