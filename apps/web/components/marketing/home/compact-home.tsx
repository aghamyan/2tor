"use client";

import Link from "next/link";
import { motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion";
import {
  ArrowRight,
  BookOpenCheck,
  Braces,
  Clock,
  Languages,
  LineChart,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
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
  confidence: string;
  note: ClassroomNote;
}

/** The frame around the rotating lesson. These strings are student-level, so they hold still. */
export interface ClassroomCopy {
  ariaLabel: string;
  live: string;
  wins: string;
  streak: string;
  subjects: readonly ClassroomSubject[];
}

export interface SubjectItem {
  key: "math" | "armenian";
  name: string;
  description: string;
  href: string;
}

export interface SubjectCopy {
  eyebrow: string;
  title: string;
  hint: string;
  items: readonly SubjectItem[];
  comingSoon: {
    title: string;
    description: string;
    badge: string;
  };
}

export interface BenefitItem {
  key: "adaptive" | "parents" | "practice";
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
 * The lesson card itself. The window frame, the sidebar chrome and the streak stay put across a
 * rotation; only the parts that are genuinely per-subject cross-fade. Swapping the whole card would
 * make the hero flicker on a six-second loop, and would re-run the sidebar's chart draw for a
 * figure that never changed.
 *
 * `first` is false once the card has rotated at least once, which compresses the board's stroke
 * timings — see `classroom-boards.tsx`.
 */
function LessonWindow({
  copy,
  subject,
  first,
}: {
  copy: ClassroomCopy;
  subject: ClassroomSubject;
  first: boolean;
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

        <aside className={styles.lessonSidebar}>
          <div className={styles.sidebarLabel}>
            <TrendingUp size={13} aria-hidden="true" />
            {copy.wins}
          </div>
          <div className={styles.miniChart} aria-label={subject.confidence}>
            <svg viewBox="0 0 150 70" role="img">
              <motion.path
                d="M3 61 C25 57 26 45 46 47 S70 34 89 36 S113 16 147 10"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={reduceMotion ? { duration: 0 } : { duration: 1.05, delay: 0.9, ease }}
              />
            </svg>
          </div>
          <AnimatePresence mode="wait" initial={false}>
            <motion.strong
              key={subject.key}
              className={styles.confidence}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={swap}
            >
              {subject.confidence}
            </motion.strong>
          </AnimatePresence>
          <div className={styles.streakRow}>
            <span>
              <Sparkles size={13} aria-hidden="true" /> {copy.streak}
            </span>
            <div aria-hidden="true">
              {[0, 1, 2, 3, 4].map((day) => (
                <i key={day} className={day < 4 ? styles.streakDone : undefined} />
              ))}
            </div>
          </div>
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
 * That removal is why the rotation STOPS after showing each subject once, rather than looping.
 * WCAG 2.2.2 (Pause, Stop, Hide, Level A) requires a mechanism to pause anything that moves
 * automatically, indefinitely, alongside other content — and the chips were that mechanism.
 * Hovering pauses the timer, but hover is neither discoverable nor reachable by keyboard, so it
 * does not satisfy the criterion on its own. Content that comes to rest on its own does: after one
 * pass, roughly 12 seconds, the card is simply static. Every visitor still sees all three lessons.
 * Restoring an endless loop means restoring a visible pause control with it.
 *
 * Reduced motion does NOT stop the rotation, it only collapses every transition to zero duration.
 * Freezing it would mean a reduced-motion visitor never sees the Armenian or chess lessons at all,
 * now that there are no chips to reach them with. Reduced motion means do not animate, not do not
 * change.
 */
function useSubjectRotation(count: number) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  // Whether the card has ever left the first subject. Set where the change happens rather than
  // derived in an effect, which would cost a second render on every rotation.
  const [hasRotated, setHasRotated] = useState(false);
  const settled = index >= count - 1;

  useEffect(() => {
    if (paused || settled || count < 2) return;
    const timer = window.setInterval(() => {
      setIndex((i) => Math.min(i + 1, count - 1));
      setHasRotated(true);
    }, ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [paused, settled, count]);

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
  };
}

export function ClassroomPreview({ copy }: { copy: ClassroomCopy }) {
  const reduceMotion = useReducedMotion();
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const x = useSpring(rawX, { stiffness: 95, damping: 22, mass: 0.35 });
  const y = useSpring(rawY, { stiffness: 95, damping: 22, mass: 0.35 });

  // `hasRotated` drives the board's stroke pacing: unhurried on load, brisk once it is looping.
  const { index, hasRotated, pause, resume } = useSubjectRotation(copy.subjects.length);
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
        <LessonWindow copy={copy} subject={subject} first={!hasRotated} />
      </motion.div>

      <TeacherNote note={subject.note} swapKey={subject.key} />
    </motion.aside>
  );
}

const subjectIcons: Record<SubjectItem["key"], LucideIcon> = {
  math: LineChart,
  armenian: Languages,
};

export function SubjectExplorer({ copy }: { copy: SubjectCopy }) {
  const reduceMotion = useReducedMotion();
  return (
    <section id="courses" className={styles.subjectSection} aria-labelledby="subject-title">
      <div className={styles.sectionShell}>
        <div className={styles.subjectHeading}>
          <div>
            <p className={styles.sectionEyebrow}>{copy.eyebrow}</p>
            <h2 id="subject-title">{copy.title}</h2>
          </div>
          <span className={styles.swipeHint}>{copy.hint}</span>
        </div>
        <div className={styles.subjectRail}>
          {copy.items.map((subject, index) => {
            const Icon = subjectIcons[subject.key];
            return (
              <motion.div
                key={subject.key}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={
                  reduceMotion ? { duration: 0 } : { duration: 0.5, delay: index * 0.06, ease }
                }
              >
                <Link href={subject.href} className={styles.subjectCard}>
                  <span className={`${styles.subjectIcon} ${styles[subject.key]}`}>
                    <Icon size={19} aria-hidden="true" />
                  </span>
                  <span className={styles.subjectText}>
                    <strong>{subject.name}</strong>
                    <small>{subject.description}</small>
                  </span>
                  <ArrowRight className={styles.subjectArrow} size={18} aria-hidden="true" />
                </Link>
              </motion.div>
            );
          })}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={
              reduceMotion
                ? { duration: 0 }
                : { duration: 0.5, delay: copy.items.length * 0.06, ease }
            }
          >
            <div className={styles.subjectCardComingSoon}>
              <span className={styles.subjectComingSoonBadge}>
                <Clock size={12} aria-hidden="true" />
                {copy.comingSoon.badge}
              </span>
              <span className={styles.subjectText}>
                <strong>{copy.comingSoon.title}</strong>
                <small>{copy.comingSoon.description}</small>
              </span>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

const benefitIcons: Record<BenefitItem["key"], LucideIcon> = {
  adaptive: Braces,
  parents: ShieldCheck,
  practice: BookOpenCheck,
};

export function LearningBenefits({ copy }: { copy: BenefitsCopy }) {
  const reduceMotion = useReducedMotion();
  return (
    <section className={styles.benefitsSection} aria-labelledby="benefits-title">
      <div className={styles.sectionShell}>
        <div className={styles.benefitsIntro}>
          <p className={styles.sectionEyebrow}>{copy.eyebrow}</p>
          <h2 id="benefits-title">{copy.title}</h2>
          <p>{copy.description}</p>
        </div>

        <div className={styles.benefitTimeline}>
          <motion.span
            className={styles.timelineLine}
            aria-hidden="true"
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 1.1, ease }}
          />
          {copy.items.map((item, index) => {
            const Icon = benefitIcons[item.key];
            return (
              <motion.article
                key={item.key}
                className={styles.benefitCard}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.35 }}
                transition={
                  reduceMotion ? { duration: 0 } : { duration: 0.6, delay: index * 0.13, ease }
                }
              >
                <span className={styles.benefitNode}>
                  <Icon size={20} aria-hidden="true" />
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
