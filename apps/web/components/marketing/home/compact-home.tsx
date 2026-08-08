"use client";

import Link from "next/link";
import { motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion";
import {
  ArrowRight,
  BookOpenCheck,
  CalendarClock,
  Presentation,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import { AnimatePresence } from "framer-motion";
import { useEffect, useState, type MouseEvent } from "react";
import { ClassroomBoard, type BoardKey } from "./classroom-boards";
import styles from "./compact-home.module.css";

const ease = [0.22, 1, 0.36, 1] as const;

/** How long each subject holds before the card advances. Long enough to read the prompt. */
const ROTATE_MS = 6200;

/**
 * The teacher's note that sits under the lesson card.
 *
 * This one block replaces four separate floating elements (a parent-summary pill, a tutor-feedback
 * card, a mini-project card and the subject chips) and carries more than all of them did: who
 * taught, what they observed, what was set as practice, the topic, and whether the parent summary
 * went out. Four cards scattered around the lesson window read as clutter; one note reads as the
 * thing the product actually produces.
 */
export interface ClassroomNote {
  author: string;
  /** Two-letter monogram. Deliberately not a stock headshot of a stranger. */
  initials: string;
  role: string;
  body: string;
  /** The action the tutor set. Rendered as the one accented tag. */
  action: string;
  topic: string;
  /** Parent-visible status, e.g. "Summary sent". */
  status: string;
}

/** One lesson the hero card can show. Everything here changes when the card rotates. */
export interface ClassroomSubject {
  key: BoardKey;
  label: string;
  lesson: string;
  tutor: string;
  /** Single character for the small avatar in the lesson header. */
  tutorInitial: string;
  topic: string;
  prompt: string;
  note: ClassroomNote;
}

/** The frame around the rotating lesson. These strings are student-level, so they hold still. */
export interface ClassroomCopy {
  ariaLabel: string;
  live: string;
  /** Heading above the course list in the lesson sidebar. */
  courses: string;
  subjects: readonly ClassroomSubject[];
}

export interface SubjectItem {
  key: "math" | "programming" | "armenian" | "chess";
  name: string;
  description: string;
  href: string;
}

export interface SubjectCopy {
  eyebrow: string;
  title: string;
  hint: string;
  items: readonly SubjectItem[];
}

export interface BenefitItem {
  key: "adaptive" | "parents" | "practice" | "availability";
  title: string;
  body: string;
  signal: string;
}

export interface BenefitsCopy {
  eyebrow: string;
  title: string;
  description: string;
  items: readonly BenefitItem[];
}

/**
 * The lesson card itself. The window frame and the sidebar's course list stay put across a
 * rotation; only the parts that are genuinely per-subject cross-fade, plus the marker that slides
 * between courses. Swapping the whole card would make the hero flicker on a six-second loop.
 *
 * `first` is false once the card has rotated at least once, which compresses the board's stroke
 * timings — see `classroom-boards.tsx`.
 */
function LessonWindow({
  copy,
  subject,
  first,
  onSelect,
}: {
  copy: ClassroomCopy;
  subject: ClassroomSubject;
  first: boolean;
  onSelect: (index: number) => void;
}) {
  const reduceMotion = useReducedMotion();
  const pace = first ? 1 : 0.42;
  const swap = reduceMotion ? { duration: 0 } : { duration: 0.42, ease };

  return (
    <div className={styles.lessonWindow}>
      <div className={styles.lessonHeader}>
        <div className={styles.lessonIdentity}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={subject.key}
              className={styles.tutorAvatar}
              aria-hidden="true"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={swap}
            >
              {subject.tutorInitial}
            </motion.span>
          </AnimatePresence>
          <span className={styles.lessonTitles}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={subject.key}
                className={styles.lessonTitleSwap}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={swap}
              >
                <strong>{subject.lesson}</strong>
                <small>{subject.tutor}</small>
              </motion.span>
            </AnimatePresence>
          </span>
        </div>
        <span className={styles.liveStatus}>
          <i aria-hidden="true" /> {copy.live}
        </span>
      </div>

      <div className={styles.lessonBody}>
        <div className={styles.whiteboard}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={subject.key}
              className={styles.boardHeading}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={swap}
            >
              <span>{subject.topic}</span>
              <strong>{subject.prompt}</strong>
            </motion.div>
          </AnimatePresence>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={subject.key}
              className={styles.boardArt}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={swap}
            >
              <ClassroomBoard subject={subject.key} reduceMotion={reduceMotion} pace={pace} />
            </motion.div>
          </AnimatePresence>

          <div className={styles.boardTools} aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </div>

        {/*
         * The courses the card teaches, with the one on screen marked. This replaced a progress
         * sparkline, a "3 learning wins this week" figure and a streak row — three invented
         * statistics about a fictional student, which is a lot of chrome to say nothing. The list
         * of real subjects earns its space instead, and it tells you the card rotates, which
         * nothing else on screen did.
         */}
        <aside className={styles.lessonSidebar}>
          <p className={styles.sidebarLabel}>
            <BookOpenCheck size={13} aria-hidden="true" />
            {copy.courses}
          </p>
          {/*
            Real buttons, not decoration. This list is the rotation's stop control — see
            `useSubjectRotation` — so it has to be reachable by keyboard and operable by Enter.
            Pressing one pins that lesson and ends the auto-advance.
          */}
          <ul className={styles.courseList}>
            {copy.subjects.map((item, itemIndex) => {
              const active = item.key === subject.key;
              return (
                <li key={item.key}>
                  <button
                    type="button"
                    className={active ? styles.courseActive : undefined}
                    /* `aria-current` is the announced equivalent of the accent bar and the weight
                       change; `aria-live` is deliberately absent, since the card already narrates
                       itself through its own labelled region. */
                    aria-current={active ? "true" : undefined}
                    onClick={() => onSelect(itemIndex)}
                  >
                    {active ? (
                      <motion.i
                        layoutId="course-marker"
                        aria-hidden="true"
                        transition={reduceMotion ? { duration: 0 } : { duration: 0.42, ease }}
                      />
                    ) : null}
                    {item.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>
      </div>
    </div>
  );
}

/**
 * The teacher's note. A filled pine block, which is how this design language signals "brand
 * surface" rather than "another card" — it reads as one deliberate object beneath the lesson
 * instead of a fourth thing floating around it.
 */
function TeacherNote({ note, swapKey }: { note: ClassroomNote; swapKey: string }) {
  const reduceMotion = useReducedMotion();
  const swap = reduceMotion ? { duration: 0 } : { duration: 0.45, ease };

  return (
    <motion.div
      className={styles.teacherNote}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduceMotion ? { duration: 0 } : { duration: 0.6, delay: 1.3, ease }}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={swapKey}
          className={styles.noteInner}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={swap}
        >
          <div className={styles.noteHead}>
            <span className={styles.noteAvatar} aria-hidden="true">
              {note.initials}
            </span>
            <span className={styles.noteWho}>
              <strong>{note.author}</strong>
              <small>{note.role}</small>
            </span>
          </div>
          <p className={styles.noteBody}>{note.body}</p>
          <ul className={styles.noteTags}>
            {/* One accented tag only: the thing the student has to go and do. The other two are
                context, and three equally loud chips would flatten that hierarchy. */}
            <li className={styles.noteTagAction}>{note.action}</li>
            <li>{note.topic}</li>
            <li>{note.status}</li>
          </ul>
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}

/**
 * Drives the rotation.
 *
 * There is no manual control by design decision: the subject chips that used to pause and pin the
 * rotation were removed along with the three floating cards.
 *
 * The rotation LOOPS. It previously came to rest on the last subject, and that was not a style
 * choice — WCAG 2.2.2 (Pause, Stop, Hide, Level A) requires a mechanism to pause anything that
 * moves automatically and indefinitely alongside other content. The chips that used to provide it
 * were gone, hover is neither discoverable nor keyboard-reachable, and content that stops on its
 * own is the criterion's other escape hatch. So stopping was the only compliant option left.
 *
 * The sidebar's course list is that mechanism restored. Its rows are real buttons: clicking or
 * tabbing to one and pressing Enter selects that lesson AND halts the auto-advance for good. That
 * is a visible, keyboard-reachable stop control, which is precisely what the previous note said
 * looping would require. Hover-pause and tab-visibility pause stay as conveniences on top; neither
 * is load-bearing for compliance.
 *
 * Reduced motion does NOT stop the rotation, it only collapses every transition to zero duration.
 * Freezing it would mean a reduced-motion visitor never sees the later lessons. Reduced motion
 * means do not animate, not do not change.
 */
function useSubjectRotation(count: number) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  // Set once the visitor picks a lesson, and never cleared: an auto-advance that resumed after an
  // explicit choice would be overriding them, and would not be a "stop" in the WCAG sense.
  const [stopped, setStopped] = useState(false);
  // Whether the card has ever left the first subject. Set where the change happens rather than
  // derived in an effect, which would cost a second render on every rotation.
  const [hasRotated, setHasRotated] = useState(false);

  useEffect(() => {
    if (paused || stopped || count < 2) return;
    const timer = window.setInterval(() => {
      setIndex((i) => (i + 1) % count);
      setHasRotated(true);
    }, ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [paused, stopped, count]);

  useEffect(() => {
    const onVisibility = () => setPaused(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  return {
    index,
    hasRotated,
    pause: () => setPaused(true),
    resume: () => setPaused(false),
    select: (next: number) => {
      setStopped(true);
      setHasRotated(true);
      setIndex(next);
    },
  };
}

export function ClassroomPreview({ copy }: { copy: ClassroomCopy }) {
  const reduceMotion = useReducedMotion();
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const x = useSpring(rawX, { stiffness: 95, damping: 22, mass: 0.35 });
  const y = useSpring(rawY, { stiffness: 95, damping: 22, mass: 0.35 });

  // `hasRotated` drives the board's stroke pacing: unhurried on load, brisk once it is looping.
  const { index, hasRotated, pause, resume, select } = useSubjectRotation(copy.subjects.length);
  const subject = copy.subjects[index];

  // `copy.subjects` is authored content, never empty — but the index signature says otherwise
  // under `noUncheckedIndexedAccess`, and rendering nothing beats asserting non-null here.
  if (!subject) return null;

  function handlePointerMove(event: MouseEvent<HTMLDivElement>) {
    if (reduceMotion) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    rawX.set(((event.clientX - bounds.left) / bounds.width - 0.5) * 10);
    rawY.set(((event.clientY - bounds.top) / bounds.height - 0.5) * 8);
  }

  function resetPointer() {
    rawX.set(0);
    rawY.set(0);
  }

  return (
    <motion.aside
      className={styles.classroomStage}
      aria-label={copy.ariaLabel}
      onMouseMove={handlePointerMove}
      onMouseEnter={pause}
      onMouseLeave={() => {
        resetPointer();
        resume();
      }}
      onFocusCapture={pause}
      onBlurCapture={resume}
      initial={{ opacity: 0, y: 24, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={reduceMotion ? { duration: 0 } : { duration: 0.8, delay: 0.14, ease }}
    >
      <div className={styles.stageAura} aria-hidden="true" />
      <div className={styles.learningPath} aria-hidden="true">
        <span>∑</span>
        <span>♞</span>
        <span>Ա</span>
      </div>

      <motion.div className={styles.lessonLayer} style={{ x, y }}>
        <LessonWindow copy={copy} subject={subject} first={!hasRotated} onSelect={select} />
      </motion.div>

      <TeacherNote note={subject.note} swapKey={subject.key} />
    </motion.aside>
  );
}

/*
 * The lucide glyph map that used to live here is gone. These four subjects are now carried by
 * rendered clay plates in `public/marketing/subjects/`, keyed by the same `subject.key`, so the
 * mapping is the filename and there is nothing to keep in sync here.
 */

/**
 * The four courses, as glass.
 *
 * `app/globals.css` sets the bar for adding a second glass surface to this site, and the first
 * clause is the one that shapes this markup: "if the surface would look identical with
 * `backdrop-filter: none`, it is not glass, it is a tinted div. Glass needs real content moving
 * behind it." The section used to sit on flat paper, so glass cards on it would have been exactly
 * that tinted div.
 *
 * Hence `subjectField` — an aria-hidden backdrop of colour blooms in the palette's three field
 * tints (the tokens that exist, by their own definition, to be "placed BEHIND glass"), plus a
 * ruled grid. It is not decoration for its own sake; it is the content the cards refract, and the
 * reason each card picks up a different cast depending on where it sits over the field.
 */
export function SubjectExplorer({ copy }: { copy: SubjectCopy }) {
  const reduceMotion = useReducedMotion();
  return (
    <section id="courses" className={styles.subjectSection} aria-labelledby="subject-title">
      <div className={styles.subjectField} aria-hidden="true">
        <span className={styles.fieldGrid} />
        <span className={styles.fieldBloomOne} />
        <span className={styles.fieldBloomTwo} />
        <span className={styles.fieldBloomThree} />
      </div>

      <div className={styles.sectionShell}>
        <div className={styles.subjectHeading}>
          <div>
            <p className={styles.sectionEyebrow}>{copy.eyebrow}</p>
            <h2 id="subject-title">{copy.title}</h2>
          </div>
        </div>
        <ul className={styles.subjectRail}>
          {copy.items.map((subject, index) => {
            return (
              <motion.li
                key={subject.key}
                /*
                 * "Materialize, don't just fade": the card scales and lifts as it arrives so the
                 * glass reads as a physical surface settling into place rather than an opacity
                 * ramp. Critically damped — nothing here was thrown, so nothing should overshoot.
                 *
                 * `initial` is NOT branched on `reduceMotion`, only `transition` is. This is the
                 * convention every other motion element in this file follows, and it is load
                 * bearing: `useReducedMotion()` reads a media query, so it is false during SSR and
                 * true on a reduced-motion client. Branching a prop that renders inline styles
                 * therefore ships different `style` attributes from the server and the client, and
                 * React reports a hydration mismatch. `transition` renders no markup, so gating
                 * the duration there collapses the motion without touching the HTML.
                 */
                initial={{ opacity: 0, y: 26, scale: 0.965 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true, amount: 0.25 }}
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : { type: "spring", bounce: 0, duration: 0.55, delay: index * 0.07 }
                }
              >
                <Link href={subject.href} className={styles.subjectCard}>
                  <span className={styles.subjectSheen} aria-hidden="true" />
                  {/*
                   * `alt=""`, deliberately. The card states the subject's name and description as
                   * real text directly below, so an alt string here would make a screen reader
                   * announce the subject twice. These plates are decoration for a labelled link.
                   *
                   * Fixed 1000x1000 intrinsic size because that is what the renders are; `sizes`
                   * is what actually governs the fetched width, and it has to track the rail's
                   * breakpoints below (4-up → 2-up → 1-up) or Next ships a 4-up-sized image to a
                   * phone showing one card per row.
                   */}
                  <span className={styles.subjectPlate}>
                    <Image
                      src={`/marketing/subjects/${subject.key}.webp`}
                      alt=""
                      width={1000}
                      height={1000}
                      sizes="(max-width: 640px) 92vw, (max-width: 1100px) 46vw, 23vw"
                      className={styles.subjectPlateArt}
                    />
                  </span>
                  <span className={styles.subjectText}>
                    <strong>{subject.name}</strong>
                    <small>{subject.description}</small>
                  </span>
                  <span className={styles.subjectArrow} aria-hidden="true">
                    <ArrowRight size={16} />
                  </span>
                </Link>
              </motion.li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

/*
 * `adaptive` was `Braces`, which is the mark for code — it read as "programming" in a row about
 * teaching, and doubly so now that the subject cards sit above it. A presentation board is what a
 * live lesson actually looks like.
 */
const benefitIcons: Record<BenefitItem["key"], LucideIcon> = {
  adaptive: Presentation,
  parents: ShieldCheck,
  practice: BookOpenCheck,
  availability: CalendarClock,
};

export function LearningBenefits({ copy }: { copy: BenefitsCopy }) {
  const reduceMotion = useReducedMotion();
  return (
    <section className={styles.benefitsSection} aria-labelledby="benefits-title">
      {/* Same job as `subjectField`: the thing the glass refracts. Without it these cards would be
          tinted divs — see the header of `app/globals.css`. */}
      <div className={styles.benefitsField} aria-hidden="true">
        <span className={styles.benefitBloomOne} />
        <span className={styles.benefitBloomTwo} />
        <span className={styles.benefitBloomThree} />
      </div>
      <div className={styles.sectionShell}>
        <div className={styles.benefitsIntro}>
          <p className={styles.sectionEyebrow}>{copy.eyebrow}</p>
          <h2 id="benefits-title">{copy.title}</h2>
          <p>{copy.description}</p>
        </div>

        {/*
         * No connecting rail. It ran behind the icon nodes and read as a line struck THROUGH the
         * row rather than a thread joining it, and it only ever worked because the nodes were
         * pinned half-outside the cards to sit on top of it. With the cards on glass the icon
         * belongs inside the card, like the subject cards above, and the rail has nothing left to
         * connect.
         */}
        <div className={styles.benefitTimeline}>
          {copy.items.map((item, index) => {
            const Icon = benefitIcons[item.key];
            return (
              <motion.article
                key={item.key}
                className={styles.benefitCard}
                initial={{ opacity: 0, y: 26, scale: 0.965 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true, amount: 0.25 }}
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : { type: "spring", bounce: 0, duration: 0.55, delay: index * 0.07 }
                }
              >
                <span className={styles.benefitSheen} aria-hidden="true" />
                <span className={`${styles.benefitNode} ${styles[item.key]}`}>
                  <Icon size={21} aria-hidden="true" />
                </span>
                <span className={styles.benefitSignal}>{item.signal}</span>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </motion.article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
