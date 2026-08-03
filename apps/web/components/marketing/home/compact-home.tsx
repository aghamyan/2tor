"use client";

import Link from "next/link";
import { motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion";
import {
  ArrowRight,
  BookOpenCheck,
  Braces,
  Check,
  Code2,
  FileCheck2,
  Languages,
  LineChart,
  NotebookPen,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import type { MouseEvent, ReactNode } from "react";
import styles from "./compact-home.module.css";

const ease = [0.22, 1, 0.36, 1] as const;

export interface ClassroomCopy {
  ariaLabel: string;
  live: string;
  lesson: string;
  tutor: string;
  topic: string;
  prompt: string;
  feedback: string;
  feedbackBody: string;
  parentReady: string;
  wins: string;
  confidence: string;
  streak: string;
  homework: string;
  homeworkStatus: string;
}

export interface SubjectItem {
  key: "math" | "code" | "armenian" | "sat" | "toefl";
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

function AnimatedEquation({ reduceMotion }: { reduceMotion: boolean | null }) {
  return (
    <svg className={styles.equation} viewBox="0 0 390 176" aria-hidden="true">
      <motion.path
        d="M35 58 L70 102 M70 58 L35 102"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={reduceMotion ? { duration: 0 } : { duration: 0.55, delay: 0.45, ease }}
      />
      <motion.path
        d="M96 80 L130 80 M113 63 L113 97"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={reduceMotion ? { duration: 0 } : { duration: 0.8, delay: 0.68, ease }}
      />
      <motion.path
        d="M157 63 C174 54 193 59 193 72 C193 81 184 85 173 85 C186 85 196 91 196 102 C196 117 176 121 157 112"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={reduceMotion ? { duration: 0 } : { duration: 0.8, delay: 0.9, ease }}
      />
      <motion.path
        d="M222 74 L255 74 M222 96 L255 96"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={reduceMotion ? { duration: 0 } : { duration: 0.75, delay: 1.1, ease }}
      />
      <motion.path
        d="M304 84 C286 77 287 57 304 56 C321 57 321 77 304 84 C285 91 286 114 304 116 C323 114 323 91 304 84"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={reduceMotion ? { duration: 0 } : { duration: 0.8, delay: 1.32, ease }}
      />
      <motion.path
        className={styles.answerStroke}
        d="M40 132 C104 148 193 151 354 128"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={reduceMotion ? { duration: 0 } : { duration: 0.9, delay: 1.45, ease }}
      />
    </svg>
  );
}

function LessonWindow({ copy }: { copy: ClassroomCopy }) {
  const reduceMotion = useReducedMotion();

  return (
    <div className={styles.lessonWindow}>
      <div className={styles.lessonHeader}>
        <div className={styles.lessonIdentity}>
          <span className={styles.tutorAvatar} aria-hidden="true">
            A
          </span>
          <span>
            <strong>{copy.lesson}</strong>
            <small>{copy.tutor}</small>
          </span>
        </div>
        <span className={styles.liveStatus}>
          <i aria-hidden="true" /> {copy.live}
        </span>
      </div>

      <div className={styles.lessonBody}>
        <div className={styles.whiteboard}>
          <div className={styles.boardHeading}>
            <span>{copy.topic}</span>
            <strong>{copy.prompt}</strong>
          </div>
          <AnimatedEquation reduceMotion={reduceMotion} />
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
          <div className={styles.miniChart} aria-label={copy.confidence}>
            <svg viewBox="0 0 150 70" role="img">
              <motion.path
                d="M3 61 C25 57 26 45 46 47 S70 34 89 36 S113 16 147 10"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={reduceMotion ? { duration: 0 } : { duration: 1.05, delay: 0.9, ease }}
              />
            </svg>
          </div>
          <strong className={styles.confidence}>{copy.confidence}</strong>
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

export function ClassroomPreview({ copy }: { copy: ClassroomCopy }) {
  const reduceMotion = useReducedMotion();
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const x = useSpring(rawX, { stiffness: 95, damping: 22, mass: 0.35 });
  const y = useSpring(rawY, { stiffness: 95, damping: 22, mass: 0.35 });

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
      onMouseLeave={resetPointer}
      initial={{ opacity: 0, y: 24, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={reduceMotion ? { duration: 0 } : { duration: 0.8, delay: 0.14, ease }}
    >
      <div className={styles.stageAura} aria-hidden="true" />
      <div className={styles.learningPath} aria-hidden="true">
        <span>∑</span>
        <span>&lt;/&gt;</span>
        <span>Ա</span>
      </div>

      <motion.div className={styles.lessonLayer} style={{ x, y }}>
        <LessonWindow copy={copy} />
      </motion.div>

      <FeatureCard
        className={styles.feedbackCard}
        icon={<NotebookPen size={17} aria-hidden="true" />}
        eyebrow={copy.feedback}
        body={copy.feedbackBody}
        delay={1.25}
      />

      <motion.div
        className={styles.parentCard}
        initial={{ opacity: 0, x: 22 }}
        animate={{ opacity: 1, x: 0 }}
        transition={reduceMotion ? { duration: 0 } : { duration: 0.55, delay: 1.75, ease }}
      >
        <span className={styles.parentIcon}>
          <Check size={15} aria-hidden="true" />
        </span>
        <span>
          <strong>{copy.parentReady}</strong>
          <small>Sent after the lesson</small>
        </span>
      </motion.div>

      <motion.div
        className={styles.homeworkCard}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reduceMotion ? { duration: 0 } : { duration: 0.55, delay: 1.45, ease }}
      >
        <FileCheck2 size={18} aria-hidden="true" />
        <span>
          <small>{copy.homework}</small>
          <strong>{copy.homeworkStatus}</strong>
        </span>
        <span className={styles.completeMark} aria-label="Complete">
          <Check size={13} />
        </span>
      </motion.div>
    </motion.aside>
  );
}

function FeatureCard({
  className,
  icon,
  eyebrow,
  body,
  delay,
}: {
  className?: string;
  icon: ReactNode;
  eyebrow: string;
  body: string;
  delay: number;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, x: -20, y: 10 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={reduceMotion ? { duration: 0 } : { duration: 0.55, delay, ease }}
    >
      <span className={styles.feedbackIcon}>{icon}</span>
      <span>
        <small>{eyebrow}</small>
        <strong>{body}</strong>
      </span>
    </motion.div>
  );
}

const subjectIcons: Record<SubjectItem["key"], LucideIcon> = {
  math: LineChart,
  code: Code2,
  armenian: Languages,
  sat: Target,
  toefl: BookOpenCheck,
};

export function SubjectExplorer({ copy }: { copy: SubjectCopy }) {
  const reduceMotion = useReducedMotion();
  return (
    <section className={styles.subjectSection} aria-labelledby="subject-title">
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
