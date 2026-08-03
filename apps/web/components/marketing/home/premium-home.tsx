"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import {
  AnimatePresence,
  MotionConfig,
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  Award,
  BarChart3,
  BookOpenCheck,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleCheck,
  GraduationCap,
  LayoutDashboard,
  ListChecks,
  MessageSquareText,
  Network,
  Route,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Locale } from "@app/i18n/config";
import { localHref } from "./content";
import { premiumHomeCopy, type PremiumHomeCopy } from "./premium-content";
import styles from "./premium-home.module.css";

const ease = [0.22, 1, 0.36, 1] as const;

function Reveal({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 32 }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.18 }}
      transition={{ duration: 0.75, ease }}
    >
      {children}
    </motion.div>
  );
}

function ArrowLink({
  href,
  children,
  light = false,
}: {
  href: string;
  children: ReactNode;
  light?: boolean;
}) {
  return (
    <Link className={`${styles.arrowLink} ${light ? styles.arrowLinkLight : ""}`} href={href}>
      <span>{children}</span>
      <ArrowUpRight aria-hidden="true" size={17} strokeWidth={1.8} />
    </Link>
  );
}

function LearningRecord({ copy }: { copy: PremiumHomeCopy }) {
  const reduce = useReducedMotion();
  const stageX = useMotionValue(0);
  const stageY = useMotionValue(0);
  const x = useSpring(stageX, { stiffness: 110, damping: 22, mass: 0.35 });
  const y = useSpring(stageY, { stiffness: 110, damping: 22, mass: 0.35 });

  function onMove(event: MouseEvent<HTMLDivElement>) {
    if (reduce) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    stageX.set(((event.clientX - bounds.left) / bounds.width - 0.5) * 12);
    stageY.set(((event.clientY - bounds.top) / bounds.height - 0.5) * 10);
  }

  function onLeave() {
    stageX.set(0);
    stageY.set(0);
  }

  return (
    <div className={styles.recordStage} onMouseMove={onMove} onMouseLeave={onLeave}>
      <div className={styles.stageGlow} aria-hidden="true" />
      <motion.div className={styles.recordWindow} style={{ x, y }}>
        <div className={styles.recordTopbar}>
          <div className={styles.recordIdentity}>
            <span className={styles.studentAvatar}>M</span>
            <div>
              <strong>{copy.ui.learningRecord}</strong>
              <span>{copy.ui.currentTerm} · Grade 7</span>
            </div>
          </div>
          <span className={styles.livePill}>
            <span aria-hidden="true" /> {copy.ui.live}
          </span>
        </div>
        <div className={styles.recordBody}>
          <div className={styles.recordNav} aria-hidden="true">
            <span className={styles.recordNavActive}>
              <LayoutDashboard size={16} />
            </span>
            <span>
              <BookOpenCheck size={16} />
            </span>
            <span>
              <BarChart3 size={16} />
            </span>
            <span>
              <MessageSquareText size={16} />
            </span>
          </div>
          <div className={styles.recordContent}>
            <div className={styles.recordHeading}>
              <div>
                <span>{copy.ui.progress}</span>
                <strong>78%</strong>
              </div>
              <span className={styles.trendPill}>
                <TrendingUp size={13} /> +12%
              </span>
            </div>
            <div className={styles.chart} aria-hidden="true">
              <span className={styles.chartGrid} />
              <motion.svg
                viewBox="0 0 430 130"
                initial={reduce ? false : { opacity: 0, scaleX: 0.15 }}
                animate={{ opacity: 1, scaleX: 1 }}
                transition={{ duration: 1.2, delay: 0.25, ease }}
                style={{ transformOrigin: "left center" }}
              >
                <defs>
                  <linearGradient id="premiumChartFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#2f65f5" stopOpacity=".24" />
                    <stop offset="1" stopColor="#2f65f5" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  d="M3 116 C50 113 55 91 97 94 S153 70 190 74 S244 44 282 51 S345 22 427 14 L427 130 L3 130Z"
                  fill="url(#premiumChartFill)"
                />
                <path
                  d="M3 116 C50 113 55 91 97 94 S153 70 190 74 S244 44 282 51 S345 22 427 14"
                  fill="none"
                  stroke="#2f65f5"
                  strokeLinecap="round"
                  strokeWidth="4"
                />
                <circle cx="427" cy="14" r="6" fill="#fff" stroke="#2f65f5" strokeWidth="4" />
              </motion.svg>
            </div>
            <div className={styles.recordGrid}>
              <div className={styles.skillCard}>
                <div className={styles.cardKicker}>
                  <Target size={14} /> Skills
                </div>
                {[84, 71, 62].map((value, index) => (
                  <div className={styles.skillRow} key={value}>
                    <span>{["Algebra", "Geometry", "Data"][index]}</span>
                    <div className={styles.skillTrack}>
                      <motion.span
                        initial={reduce ? false : { scaleX: 0 }}
                        animate={{ scaleX: value / 100 }}
                        transition={{ duration: 0.9, delay: 0.55 + index * 0.12, ease }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className={styles.sessionCard}>
                <div className={styles.cardKicker}>
                  <CalendarDays size={14} /> {copy.ui.nextSession}
                </div>
                <strong>Friday · 4:00 PM</strong>
                <span>{copy.ui.weeklyClinic}</span>
                <em>{copy.ui.freeIncluded}</em>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      <motion.div
        className={`${styles.floatCard} ${styles.feedbackFloat}`}
        initial={reduce ? false : { opacity: 0, x: 24, y: 12 }}
        animate={reduce ? { opacity: 1 } : { opacity: 1, x: 0, y: [0, -6, 0] }}
        transition={
          reduce
            ? { duration: 0 }
            : {
                opacity: { duration: 0.6, delay: 0.7 },
                x: { duration: 0.6, delay: 0.7, ease },
                y: { duration: 5, repeat: Infinity, ease: "easeInOut" },
              }
        }
      >
        <span className={styles.floatIcon}>
          <Check size={16} />
        </span>
        <span>
          <strong>{copy.ui.lessonComplete}</strong>
          <small>{copy.ui.feedbackReady}</small>
        </span>
      </motion.div>

      <motion.div
        className={`${styles.floatCard} ${styles.tutorFloat}`}
        initial={reduce ? false : { opacity: 0, x: -22, y: 12 }}
        animate={reduce ? { opacity: 1 } : { opacity: 1, x: 0, y: [0, 5, 0] }}
        transition={
          reduce
            ? { duration: 0 }
            : {
                opacity: { duration: 0.6, delay: 0.95 },
                x: { duration: 0.6, delay: 0.95, ease },
                y: { duration: 6.3, repeat: Infinity, ease: "easeInOut" },
              }
        }
      >
        <span className={styles.tutorAvatar}>AS</span>
        <span>
          <strong>Anna S.</strong>
          <small>
            <ShieldCheck size={12} /> {copy.ui.verifiedTutor}
          </small>
        </span>
      </motion.div>

      <motion.div
        className={`${styles.floatCard} ${styles.homeworkFloat}`}
        initial={reduce ? false : { opacity: 0, y: 20 }}
        animate={reduce ? { opacity: 1 } : { opacity: 1, y: [0, -4, 0] }}
        transition={
          reduce
            ? { duration: 0 }
            : {
                opacity: { duration: 0.6, delay: 1.15 },
                y: { duration: 5.7, delay: 1.15, repeat: Infinity, ease: "easeInOut" },
              }
        }
      >
        <span>
          <strong>{copy.ui.homework}</strong>
          <small>12 / 12 · {copy.ui.submitted}</small>
        </span>
        <CircleCheck size={19} />
      </motion.div>
      <span className={styles.stageCaption}>{copy.ui.sample}</span>
    </div>
  );
}

function Hero({ copy, locale }: { copy: PremiumHomeCopy; locale: Locale }) {
  const reduce = useReducedMotion();
  const section = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: section, offset: ["start start", "end start"] });
  const copyY = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : 56]);
  const visualY = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : 88]);
  const startHref = localHref(locale, "/consultation");

  return (
    <section className={styles.hero} id="overview" ref={section}>
      <span className={styles.heroGrid} aria-hidden="true" />
      <div className={styles.shell}>
        <div className={styles.heroLayout}>
          <motion.div className={styles.heroCopy} style={{ y: copyY }}>
            <motion.p
              className={styles.eyebrow}
              initial={reduce ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease }}
            >
              <span className={styles.eyebrowDot} aria-hidden="true" />
              {copy.hero.eyebrow}
            </motion.p>
            <motion.h1
              className={styles.heroTitle}
              initial={reduce ? false : { opacity: 0, y: 26 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.08, ease }}
            >
              {copy.hero.titleLead}
              <br />
              <span>{copy.hero.titleAccent}</span>
            </motion.h1>
            <motion.p
              className={styles.heroDescription}
              initial={reduce ? false : { opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.18, ease }}
            >
              {copy.hero.description}
            </motion.p>
            <motion.div
              className={styles.heroActions}
              initial={reduce ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, delay: 0.26, ease }}
            >
              <Link className={styles.primaryCta} href={startHref}>
                {copy.hero.primary}
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
              <a className={styles.secondaryCta} href="#how-it-works">
                <span className={styles.playIcon} aria-hidden="true">
                  ▶
                </span>
                {copy.hero.secondary}
              </a>
            </motion.div>
            <motion.p
              className={styles.heroProof}
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.65, delay: 0.4 }}
            >
              <ShieldCheck size={15} aria-hidden="true" /> {copy.hero.proof}
            </motion.p>
          </motion.div>
          <motion.div className={styles.heroVisual} style={{ y: visualY }}>
            <LearningRecord copy={copy} />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function TrustStrip({ copy }: { copy: PremiumHomeCopy }) {
  const icons = [BookOpenCheck, ShieldCheck, MessageSquareText, CalendarDays];
  return (
    <section className={styles.trustSection} aria-label={copy.trust.label}>
      <div className={styles.shell}>
        <div className={styles.trustPanel}>
          <p>{copy.trust.label}</p>
          <div className={styles.trustItems}>
            {copy.trust.items.map((item, index) => {
              const Icon = icons[index];
              return (
                <span key={item}>
                  {Icon ? <Icon size={17} aria-hidden="true" /> : null}
                  {item}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

const pageSectionHrefs = ["#learning-system", "#subjects", "#how-it-works", "#faq"] as const;

function PageNavigator({ copy, locale }: { copy: PremiumHomeCopy; locale: Locale }) {
  const [activeHref, setActiveHref] = useState("#learning-system");
  const destinations = [
    { href: "#learning-system", label: copy.navigation.system, icon: Network },
    { href: "#subjects", label: copy.navigation.subjects, icon: GraduationCap },
    { href: "#how-it-works", label: copy.navigation.process, icon: Route },
    { href: "#faq", label: copy.navigation.faq, icon: MessageSquareText },
  ];

  useEffect(() => {
    const sections = pageSectionHrefs.flatMap((href) => {
      const section = document.querySelector(href);
      return section ? [section] : [];
    });
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((entry) => entry.isIntersecting);
        if (visible?.target.id) setActiveHref(`#${visible.target.id}`);
      },
      { rootMargin: "-30% 0px -58%", threshold: 0.01 },
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  return (
    <div className={styles.pageNavDock}>
      <div className={styles.shell}>
        <nav className={styles.pageNavigator} aria-label={copy.navigation.label}>
          <span className={styles.pageNavLabel}>
            <i aria-hidden="true" />
            {copy.navigation.label}
          </span>
          <div className={styles.pageNavLinks}>
            {destinations.map(({ href, label, icon: Icon }) => (
              <a
                className={activeHref === href ? styles.pageNavActive : undefined}
                href={href}
                key={href}
                aria-current={activeHref === href ? "location" : undefined}
                onClick={() => setActiveHref(href)}
              >
                <Icon size={15} aria-hidden="true" />
                <span>{label}</span>
              </a>
            ))}
          </div>
          <Link className={styles.pageNavStart} href={localHref(locale, "/consultation")}>
            {copy.navigation.start}
            <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
        </nav>
      </div>
    </div>
  );
}

function CurriculumVisual({ copy }: { copy: PremiumHomeCopy }) {
  const reduce = useReducedMotion();
  const labels = ["Expressions", "Linear equations", "Systems", "Functions"];
  return (
    <div className={styles.curriculumVisual} aria-hidden="true">
      <div className={styles.visualWindowBar}>
        <span />
        <span />
        <span />
        <em>US.MATH.7</em>
      </div>
      <div className={styles.roadmap}>
        <motion.span
          className={styles.roadmapLine}
          initial={reduce ? false : { scaleY: 0 }}
          whileInView={{ scaleY: 1 }}
          viewport={{ once: true, amount: 0.8 }}
          transition={{ duration: 1.1, ease }}
        />
        {labels.map((label, index) => (
          <motion.div
            className={styles.roadmapStep}
            key={label}
            initial={reduce ? false : { opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.48, delay: 0.18 + index * 0.16, ease }}
          >
            <motion.span
              className={index < 3 ? styles.roadmapDone : styles.roadmapCurrent}
              initial={reduce ? false : { scale: 0 }}
              whileInView={{ scale: 1 }}
              viewport={{ once: true }}
              transition={{
                type: "spring",
                stiffness: 220,
                damping: 18,
                delay: 0.22 + index * 0.16,
              }}
            >
              {index < 3 ? <Check size={14} /> : index + 1}
            </motion.span>
            <div>
              <strong>{label}</strong>
              <small>{index < 3 ? copy.ui.mastered : copy.ui.inProgress}</small>
            </div>
            {index === 3 ? <em>72%</em> : null}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function FeedbackVisual({ copy }: { copy: PremiumHomeCopy }) {
  const reduce = useReducedMotion();
  const entries = [
    [copy.ui.attendance, "Present", CheckCircle2],
    [copy.ui.homework, copy.ui.submitted, ListChecks],
    [copy.ui.strengths, "Logical reasoning", Star],
    [copy.ui.improvement, "Multi-step proofs", Target],
  ] as const;
  return (
    <div className={styles.feedbackVisual}>
      <motion.div
        className={styles.lessonEnded}
        initial={reduce ? false : { opacity: 0, scale: 0.92 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, ease }}
      >
        <span>
          <CircleCheck size={20} />
        </span>
        <div>
          <strong>{copy.ui.lessonComplete}</strong>
          <small>Algebra · 54 min</small>
        </div>
      </motion.div>
      <div className={styles.feedbackSheet}>
        <div className={styles.feedbackSheetHead}>
          <span>{copy.ui.feedbackReady}</span>
          <em>Just now</em>
        </div>
        {entries.map(([label, value, Icon], index) => (
          <motion.div
            className={styles.feedbackEntry}
            key={label}
            initial={reduce ? false : { opacity: 0, x: 24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.28 + index * 0.13, ease }}
          >
            <Icon size={17} />
            <span>
              <small>{label}</small>
              <strong>{value}</strong>
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function DashboardVisual({ copy }: { copy: PremiumHomeCopy }) {
  const reduce = useReducedMotion();
  return (
    <div className={styles.dashboardVisual} aria-hidden="true">
      <div className={styles.miniSidebar}>
        <span className={styles.miniActive} />
        <span />
        <span />
        <span />
      </div>
      <div className={styles.dashboardMain}>
        <div className={styles.dashboardHeader}>
          <div>
            <small>{copy.ui.currentTerm}</small>
            <strong>{copy.ui.progress}</strong>
          </div>
          <em>↗ 12%</em>
        </div>
        <div className={styles.dashboardChart}>
          {[28, 42, 38, 57, 68, 80, 92].map((height, index) => (
            <motion.span
              key={index}
              initial={reduce ? false : { scaleY: 0 }}
              whileInView={{ scaleY: height / 100 }}
              viewport={{ once: true }}
              transition={{ duration: 0.65, delay: index * 0.08, ease }}
            />
          ))}
        </div>
        <div className={styles.dashboardStats}>
          {[
            ["Attendance", "96%"],
            ["Homework", "18/20"],
            ["Milestones", "7"],
          ].map(([label, value], index) => (
            <motion.div
              key={label}
              initial={reduce ? false : { opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.5 + index * 0.1, ease }}
            >
              <small>{label}</small>
              <strong>{value}</strong>
            </motion.div>
          ))}
        </div>
        <motion.div
          className={styles.achievementToast}
          initial={reduce ? false : { opacity: 0, x: 30, rotate: 2 }}
          whileInView={{ opacity: 1, x: 0, rotate: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.8, ease }}
        >
          <Award size={18} />
          <span>
            <small>Achievement unlocked</small>
            <strong>Equation explorer</strong>
          </span>
        </motion.div>
      </div>
    </div>
  );
}

function TutorsVisual({ copy }: { copy: PremiumHomeCopy }) {
  const reduce = useReducedMotion();
  return (
    <div className={styles.tutorsVisual}>
      <motion.div
        className={styles.tutorProfile}
        initial={reduce ? false : { opacity: 0, x: -32, rotate: -3 }}
        whileInView={{ opacity: 1, x: 0, rotate: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7, ease }}
      >
        <div className={styles.tutorPortrait}>
          AM<span>AM</span>
        </div>
        <div className={styles.tutorName}>
          <div>
            <strong>Ani M.</strong>
            <small>Mathematics educator</small>
          </div>
          <motion.span
            initial={reduce ? false : { scale: 0, rotate: -25 }}
            whileInView={{ scale: 1, rotate: 0 }}
            viewport={{ once: true }}
            transition={{ type: "spring", delay: 0.5 }}
          >
            <ShieldCheck size={18} />
          </motion.span>
        </div>
        <div className={styles.rating}>
          <Star size={14} fill="currentColor" /> 4.9 <span>· 186 lessons</span>
        </div>
      </motion.div>
      <div className={styles.credentialStack}>
        {[
          [GraduationCap, copy.ui.degree],
          [BriefcaseBusiness, copy.ui.experience],
          [CheckCircle2, "Teaching sample evaluated"],
        ].map(([Icon, text], index) => {
          const CredentialIcon = Icon as LucideIcon;
          return (
            <motion.div
              key={String(text)}
              initial={reduce ? false : { opacity: 0, x: 26 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.35 + index * 0.14, ease }}
            >
              <span>
                <CredentialIcon size={17} />
              </span>
              <strong>{String(text)}</strong>
              <Check size={15} />
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function GroupsVisual() {
  const reduce = useReducedMotion();
  const students = ["MK", "LS", "AN", "JT"];
  return (
    <div className={styles.groupsVisual}>
      <div className={styles.groupCanvas} aria-hidden="true">
        <span className={styles.connectionLine} />
        {students.map((student, index) => (
          <motion.div
            className={`${styles.groupAvatar} ${styles[`groupAvatar${index + 1}`]}`}
            key={student}
            initial={
              reduce
                ? false
                : {
                    opacity: index === 0 ? 1 : 0,
                    x: index === 0 ? 110 : index % 2 ? -35 : 35,
                    y: index === 0 ? 75 : index < 3 ? 25 : -25,
                    scale: index === 0 ? 1.15 : 0.75,
                  }
            }
            whileInView={{ opacity: 1, x: 0, y: 0, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.75, delay: index * 0.16, ease }}
          >
            {student}
          </motion.div>
        ))}
        <motion.span
          className={styles.chatBubbleOne}
          initial={reduce ? false : { opacity: 0, scale: 0.65 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.65, type: "spring" }}
        >
          x = 12
        </motion.span>
        <motion.span
          className={styles.chatBubbleTwo}
          initial={reduce ? false : { opacity: 0, scale: 0.65 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.82, type: "spring" }}
        >
          Why?
        </motion.span>
      </div>
      <div className={styles.groupMetrics}>
        <div>
          <small>Private</small>
          <strong>$34</strong>
          <span>/ lesson</span>
        </div>
        <ArrowRight size={18} />
        <motion.div
          initial={reduce ? false : { opacity: 0, x: 18 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.65, ease }}
        >
          <small>Small group</small>
          <strong>$12</strong>
          <span>/ lesson</span>
        </motion.div>
      </div>
    </div>
  );
}

function WeeklyVisual({ copy }: { copy: PremiumHomeCopy }) {
  const reduce = useReducedMotion();
  return (
    <div className={styles.weeklyVisual}>
      <div className={styles.calendarCard}>
        <div className={styles.calendarHead}>
          <span>October</span>
          <CalendarDays size={18} />
        </div>
        <div className={styles.weekdays}>
          {["M", "T", "W", "T", "F", "S", "S"].map((day, index) => (
            <span key={`${day}${index}`}>{day}</span>
          ))}
        </div>
        <div className={styles.calendarDays}>
          {Array.from({ length: 21 }, (_, index) => (
            <motion.span
              className={index === 18 ? styles.friday : ""}
              key={index}
              initial={reduce || index !== 18 ? false : { scale: 0.7 }}
              whileInView={index === 18 ? { scale: 1 } : undefined}
              viewport={{ once: true }}
              transition={{ type: "spring", delay: 0.35 }}
            >
              {index + 1}
            </motion.span>
          ))}
        </div>
        <motion.div
          className={styles.clinicEvent}
          initial={reduce ? false : { opacity: 0, x: -16 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.55, duration: 0.55, ease }}
        >
          <span>
            <Sparkles size={15} />
          </span>
          <div>
            <strong>{copy.ui.weeklyClinic}</strong>
            <small>Friday · 5:00 PM · 60 min</small>
          </div>
          <em>{copy.ui.freeIncluded}</em>
        </motion.div>
      </div>
      <div className={styles.questionsStack} aria-hidden="true">
        {["?", "?", "✓"].map((value, index) => (
          <motion.span
            key={index}
            initial={reduce ? false : { opacity: 0, x: 18, rotate: 8 }}
            whileInView={{ opacity: 1, x: index * -14, y: index * -10, rotate: index * -3 }}
            viewport={{ once: true }}
            transition={{ delay: 0.5 + index * 0.13, duration: 0.5, ease }}
          >
            {value}
          </motion.span>
        ))}
      </div>
    </div>
  );
}

function FeatureVisual({
  type,
  copy,
}: {
  type: PremiumHomeCopy["features"][number]["key"];
  copy: PremiumHomeCopy;
}) {
  switch (type) {
    case "curriculum":
      return <CurriculumVisual copy={copy} />;
    case "feedback":
      return <FeedbackVisual copy={copy} />;
    case "dashboard":
      return <DashboardVisual copy={copy} />;
    case "tutors":
      return <TutorsVisual copy={copy} />;
    case "groups":
      return <GroupsVisual />;
    case "weekly":
      return <WeeklyVisual copy={copy} />;
  }
}

function FeatureStory({ copy }: { copy: PremiumHomeCopy }) {
  return (
    <section className={styles.storySection} id="learning-system">
      <div className={styles.shell}>
        <Reveal className={styles.storyIntro}>
          <p className={styles.sectionEyebrow}>{copy.story.eyebrow}</p>
          <h2 className={styles.sectionTitle}>{copy.story.title}</h2>
          <p className={styles.sectionDescription}>{copy.story.description}</p>
        </Reveal>
        <div className={styles.storyList}>
          {copy.features.map((feature, index) => (
            <motion.article
              className={`${styles.storyCard} ${index % 2 ? styles.storyCardReverse : ""}`}
              key={feature.key}
              initial={{ opacity: 0, y: 42 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.14 }}
              transition={{ duration: 0.8, ease }}
            >
              <div className={styles.storyCopy}>
                <span className={styles.storyNumber}>SYSTEM / 0{index + 1}</span>
                <p className={styles.storyLabel}>{feature.label}</p>
                <h3>{feature.title}</h3>
                <p className={styles.storyBody}>{feature.body}</p>
                <ul>
                  {feature.points.map((point) => (
                    <li key={point}>
                      <Check size={14} /> {point}
                    </li>
                  ))}
                </ul>
              </div>
              <div className={`${styles.storyVisual} ${styles[`storyVisual${feature.key}`]}`}>
                <FeatureVisual type={feature.key} copy={copy} />
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}

function GoalSelector({ copy, locale }: { copy: PremiumHomeCopy; locale: Locale }) {
  const [selected, setSelected] = useState(0);
  const reduce = useReducedMotion();
  const icons = [BookOpenCheck, Target, TrendingUp, Users];
  const goal = copy.goals.items[selected] ?? copy.goals.items[0];
  if (!goal) return null;
  return (
    <section className={styles.goalSection}>
      <div className={styles.shell}>
        <Reveal className={styles.centerHead}>
          <p className={styles.sectionEyebrow}>{copy.goals.eyebrow}</p>
          <h2 className={styles.sectionTitle}>{copy.goals.title}</h2>
          <p className={styles.sectionDescription}>{copy.goals.description}</p>
        </Reveal>
        <div className={styles.goalLayout}>
          <div className={styles.goalOptions} role="group" aria-label={copy.goals.eyebrow}>
            {copy.goals.items.map((item, index) => {
              const Icon = icons[index] ?? Target;
              return (
                <motion.button
                  type="button"
                  className={`${styles.goalButton} ${selected === index ? styles.goalButtonActive : ""}`}
                  key={item.title}
                  onClick={() => setSelected(index)}
                  aria-pressed={selected === index}
                  whileHover={reduce ? undefined : { x: 4 }}
                  whileTap={reduce ? undefined : { scale: 0.99 }}
                >
                  <span>
                    <Icon size={18} />
                  </span>
                  <strong>{item.title}</strong>
                  <ArrowRight size={16} />
                </motion.button>
              );
            })}
          </div>
          <div className={styles.goalPreview}>
            <span className={styles.goalPreviewGrid} aria-hidden="true" />
            <AnimatePresence mode="wait">
              <motion.div
                key={selected}
                initial={reduce ? false : { opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? undefined : { opacity: 0, y: -10 }}
                transition={{ duration: 0.38, ease }}
              >
                <p>{copy.ui.selectedPlan}</p>
                <span className={styles.goalBadge}>{goal.label}</span>
                <h3>{goal.plan}</h3>
                <p className={styles.goalDetail}>{goal.detail}</p>
                <div className={styles.goalTimeline} aria-hidden="true">
                  {["Assess", "Plan", "Learn", "Review"].map((step, index) => (
                    <span key={step}>
                      <i>{index + 1}</i>
                      <em>{step}</em>
                    </span>
                  ))}
                </div>
                <ArrowLink href={localHref(locale, "/consultation")} light>
                  {copy.ui.viewPlan}
                </ArrowLink>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}

function Subjects({ copy, locale }: { copy: PremiumHomeCopy; locale: Locale }) {
  return (
    <section className={styles.subjectsSection} id="subjects">
      <div className={styles.shell}>
        <Reveal className={styles.subjectsHead}>
          <p className={styles.sectionEyebrow}>{copy.subjects.eyebrow}</p>
          <h2 className={styles.sectionTitle}>{copy.subjects.title}</h2>
          <p className={styles.sectionDescription}>{copy.subjects.description}</p>
        </Reveal>
        <div className={styles.subjectGrid}>
          <motion.article
            className={`${styles.subjectCard} ${styles.mathCard}`}
            whileHover={{ y: -6 }}
            transition={{ duration: 0.35, ease }}
          >
            <div className={styles.subjectCopy}>
              <span className={styles.subjectLabel}>{copy.subjects.math.label}</span>
              <h3>{copy.subjects.math.title}</h3>
              <p>{copy.subjects.math.body}</p>
              <div className={styles.subjectTags}>
                {copy.subjects.math.tags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
              <ArrowLink href={localHref(locale, "/mathematics")}>
                {copy.subjects.math.cta}
              </ArrowLink>
            </div>
            <div className={styles.mathVisual} aria-hidden="true">
              <span className={styles.mathOrb}>π</span>
              <span className={styles.formulaOne}>f(x) = 2x + 4</span>
              <span className={styles.formulaTwo}>∑ n²</span>
              <svg viewBox="0 0 300 180">
                <path d="M12 155 C55 151 80 123 110 128 S171 102 197 82 S237 43 286 28" />
                <circle cx="197" cy="82" r="5" />
                <circle cx="286" cy="28" r="5" />
              </svg>
            </div>
          </motion.article>
          <motion.article
            className={`${styles.subjectCard} ${styles.heritageCard}`}
            whileHover={{ y: -6 }}
            transition={{ duration: 0.35, ease }}
          >
            <div className={styles.heritagePattern} aria-hidden="true" />
            <div className={styles.subjectCopy}>
              <span className={styles.subjectLabel}>{copy.subjects.heritage.label}</span>
              <h3>{copy.subjects.heritage.title}</h3>
              <p>{copy.subjects.heritage.body}</p>
              <div className={styles.subjectTags}>
                {copy.subjects.heritage.tags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
              <ArrowLink href={localHref(locale, "/armenian-language-heritage")} light>
                {copy.subjects.heritage.cta}
              </ArrowLink>
            </div>
            <div className={styles.heritageGlyph} aria-hidden="true">
              <span>Ա</span>
              <small>AYB · 01</small>
            </div>
          </motion.article>
        </div>
      </div>
    </section>
  );
}

function Process({ copy }: { copy: PremiumHomeCopy }) {
  return (
    <section className={styles.processSection} id="how-it-works">
      <div className={styles.shell}>
        <Reveal className={styles.processHead}>
          <p className={styles.sectionEyebrow}>{copy.process.eyebrow}</p>
          <h2 className={styles.sectionTitle}>{copy.process.title}</h2>
          <p className={styles.sectionDescription}>{copy.process.description}</p>
        </Reveal>
        <ol className={styles.processList}>
          {copy.process.steps.map((step, index) => (
            <motion.li
              key={step.title}
              initial={{ opacity: 0, x: -18 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.7 }}
              transition={{ duration: 0.55, delay: index * 0.1, ease }}
            >
              <span className={styles.processNumber}>0{index + 1}</span>
              <span className={styles.processIcon}>
                {[BookOpenCheck, Users, Route, Award].map((Icon, iconIndex) =>
                  iconIndex === index ? <Icon key={iconIndex} size={19} /> : null,
                )}
              </span>
              <div>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </div>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Testimonials({ copy }: { copy: PremiumHomeCopy }) {
  return (
    <section className={styles.testimonialSection}>
      <div className={styles.shell}>
        <Reveal className={styles.testimonialHead}>
          <p className={styles.sectionEyebrow}>{copy.testimonials.eyebrow}</p>
          <h2 className={styles.sectionTitle}>{copy.testimonials.title}</h2>
        </Reveal>
        <div className={styles.testimonialGrid}>
          {copy.testimonials.items.map((item, index) => (
            <motion.blockquote
              className={styles.testimonialCard}
              key={item.quote}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              whileHover={{ y: -5 }}
              transition={{ duration: 0.6, delay: index * 0.12, ease }}
            >
              <div className={styles.quoteMark}>“</div>
              <p>{item.quote}</p>
              <footer>
                <span className={styles.parentAvatar}>P{index + 1}</span>
                <div>
                  <cite>{item.attribution}</cite>
                  <small>
                    <TrendingUp size={13} /> {item.result}
                  </small>
                </div>
              </footer>
            </motion.blockquote>
          ))}
        </div>
        <p className={styles.disclosure}>
          <ShieldCheck size={13} /> {copy.testimonials.disclosure}
        </p>
      </div>
    </section>
  );
}

function Faq({ copy }: { copy: PremiumHomeCopy }) {
  return (
    <section className={styles.faqSection} id="faq">
      <div className={styles.shell}>
        <div className={styles.faqLayout}>
          <Reveal className={styles.faqHead}>
            <p className={styles.sectionEyebrow}>{copy.faq.eyebrow}</p>
            <h2 className={styles.sectionTitle}>{copy.faq.title}</h2>
          </Reveal>
          <div className={styles.faqList}>
            {copy.faq.items.map((item) => (
              <details key={item.question}>
                <summary>
                  <span>{item.question}</span>
                  <ChevronDown size={18} aria-hidden="true" />
                </summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function FinalCta({ copy, locale }: { copy: PremiumHomeCopy; locale: Locale }) {
  return (
    <section className={styles.finalSection}>
      <span className={styles.finalGrid} aria-hidden="true" />
      <div className={styles.finalOrb} aria-hidden="true">
        <span>78%</span>
        <i />
      </div>
      <div className={styles.shell}>
        <Reveal className={styles.finalContent}>
          <p className={styles.finalEyebrow}>
            <Sparkles size={15} /> {copy.final.eyebrow}
          </p>
          <h2>{copy.final.title}</h2>
          <p>{copy.final.body}</p>
          <div className={styles.heroActions}>
            <Link className={styles.primaryCta} href={localHref(locale, "/consultation")}>
              {copy.final.primary}
              <ArrowRight size={17} />
            </Link>
            <Link className={styles.finalSecondary} href={localHref(locale, "/free-assessment")}>
              {copy.final.secondary}
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function PremiumHome({ locale }: { locale: Locale }) {
  const copy = premiumHomeCopy(locale);
  return (
    <MotionConfig reducedMotion="user">
      <div className={styles.page}>
        <Hero copy={copy} locale={locale} />
        <TrustStrip copy={copy} />
        <PageNavigator copy={copy} locale={locale} />
        <FeatureStory copy={copy} />
        <GoalSelector copy={copy} locale={locale} />
        <Subjects copy={copy} locale={locale} />
        <Process copy={copy} />
        <Testimonials copy={copy} />
        <Faq copy={copy} />
        <FinalCta copy={copy} locale={locale} />
      </div>
    </MotionConfig>
  );
}
