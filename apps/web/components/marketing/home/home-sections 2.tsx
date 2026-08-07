"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Check, UserRound } from "lucide-react";
import styles from "./compact-home.module.css";

const ease = [0.22, 1, 0.36, 1] as const;

export interface GroupLessonsCopy {
  eyebrow: string;
  title: string;
  body: string;
  points: readonly string[];
  cta: string;
  /** Label under the seat diagram, e.g. "2 to 4 students per group". */
  seatsLabel: string;
  seatsAriaLabel: string;
}

export interface ParentPreviewCopy {
  eyebrow: string;
  title: string;
  body: string;
  cta: string;
  dashboard: {
    ariaLabel: string;
    /** The signed-in surface this mirrors, named so it does not read as a generic widget. */
    label: string;
    child: string;
    /** Mirrors the section tabs on `/parents`. Only the first is shown open. */
    tabs: readonly string[];
    rows: readonly { label: string; value: string }[];
  };
}

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
  // Four seats, three taken: the arrangement states the group size before the caption does.
  const seats = [true, true, true, false];

  return (
    <section className={styles.groupSection} aria-labelledby="group-title">
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
            <h2 id="group-title">{copy.title}</h2>
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

          <div className={styles.groupSeats} aria-label={copy.seatsAriaLabel} role="img">
            <div className={styles.seatRing} aria-hidden="true">
              {seats.map((taken, index) => (
                <motion.span
                  key={index}
                  className={taken ? styles.seatTaken : styles.seatOpen}
                  initial={{ opacity: 0, scale: 0.8 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true, amount: 0.6 }}
                  transition={
                    reduceMotion
                      ? { duration: 0 }
                      : { type: "spring", bounce: 0, duration: 0.5, delay: 0.15 + index * 0.09 }
                  }
                >
                  {taken ? <UserRound size={19} aria-hidden="true" /> : null}
                </motion.span>
              ))}
            </div>
            <p aria-hidden="true">{copy.seatsLabel}</p>
          </div>
        </motion.div>
      </div>
    </section>
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
export function ParentPreviewStrip({ copy, href }: { copy: ParentPreviewCopy; href: string }) {
  const reduceMotion = useReducedMotion();

  return (
    <section className={styles.parentSection} aria-labelledby="parent-title">
      <div className={styles.sectionShell}>
        <div className={styles.parentLayout}>
          <div className={styles.parentCopy}>
            <p className={styles.sectionEyebrow}>{copy.eyebrow}</p>
            <h2 id="parent-title">{copy.title}</h2>
            <p>{copy.body}</p>
            <Link href={href} className={styles.parentCta}>
              {copy.cta}
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>

          <motion.div
            className={styles.parentPanel}
            aria-label={copy.dashboard.ariaLabel}
            role="img"
            initial={{ opacity: 0, y: 26, scale: 0.97 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={
              reduceMotion ? { duration: 0 } : { type: "spring", bounce: 0, duration: 0.6 }
            }
          >
            <div className={styles.parentPanelHead} aria-hidden="true">
              <span className={styles.parentPanelLabel}>{copy.dashboard.label}</span>
              <span className={styles.parentPanelChild}>{copy.dashboard.child}</span>
            </div>

            {/* Not a real tablist: this is a picture of one, so it takes no roles and no focus. */}
            <div className={styles.parentTabs} aria-hidden="true">
              {copy.dashboard.tabs.map((tab, index) => (
                <span key={tab} className={index === 0 ? styles.parentTabActive : undefined}>
                  {tab}
                </span>
              ))}
            </div>

            <dl className={styles.parentRows} aria-hidden="true">
              {copy.dashboard.rows.map((row, index) => (
                <motion.div
                  key={row.label}
                  initial={{ opacity: 0, y: 8 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.5 }}
                  transition={
                    reduceMotion
                      ? { duration: 0 }
                      : { duration: 0.4, delay: 0.3 + index * 0.08, ease }
                  }
                >
                  <dt>{row.label}</dt>
                  <dd>{row.value}</dd>
                </motion.div>
              ))}
            </dl>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
