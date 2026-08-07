"use client";

import {
  ArrowRight,
  Check,
  ChevronDown,
  CircleCheck,
  ClipboardCheck,
  LockKeyhole,
  MessageSquareText,
  MoveRight,
  ShieldCheck,
  Sparkles,
  Target,
  UserRoundCheck,
  X,
} from "lucide-react";
import { useLocale } from "next-intl";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import {
  curriculumById,
  curriculumGroups,
  defaultCurriculumLevel,
  journeyMilestoneIds,
  mathematicsCurriculum,
  type CurriculumLevel,
} from "./mathematics-curriculum";
import styles from "./mathematics.module.css";

const supportGoals = [
  { id: "catch-up", label: "Catch up", detail: "Rebuild missing foundations" },
  { id: "on-track", label: "Stay on track", detail: "Master current grade work" },
  { id: "move-ahead", label: "Move ahead", detail: "Prepare for the next level" },
] as const;

type SupportGoal = (typeof supportGoals)[number]["id"];
type FormStatus = "idle" | "sending" | "sent" | "error";

const levelSelectionEvent = "math-level-selection";

function getLevel(levelId: string): CurriculumLevel {
  const level = curriculumById.get(levelId) ?? curriculumById.get(defaultCurriculumLevel);
  if (!level) throw new Error("The mathematics curriculum requires a default level.");
  return level;
}

function getSupportGoal(goalId: SupportGoal) {
  const goal = supportGoals.find((item) => item.id === goalId) ?? supportGoals[1];
  if (!goal) throw new Error("The booking flow requires a default support goal.");
  return goal;
}

function selectedLevelSnapshot() {
  const fromUrl = new URLSearchParams(window.location.search).get("level");
  return fromUrl && curriculumById.has(fromUrl) ? fromUrl : defaultCurriculumLevel;
}

function subscribeToLevelSelection(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  window.addEventListener(levelSelectionEvent, onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(levelSelectionEvent, onChange);
  };
}

function journeyStageFor(level: CurriculumLevel) {
  const levelIndex = mathematicsCurriculum.findIndex((item) => item.id === level.id);
  let milestone: (typeof journeyMilestoneIds)[number] = journeyMilestoneIds[0];
  for (const milestoneId of journeyMilestoneIds) {
    const milestoneIndex = mathematicsCurriculum.findIndex((item) => item.id === milestoneId);
    if (milestoneIndex <= levelIndex) milestone = milestoneId;
  }
  return milestone;
}

function ageBandFor(levelId: string) {
  if (levelId === "grade-1") return "under_8";
  if (["grade-2", "grade-3", "grade-4", "grade-5"].includes(levelId)) return "8_10";
  if (["grade-6", "grade-7", "grade-8", "pre-algebra"].includes(levelId)) return "11_13";
  return "14_17";
}

export function MathematicsPage() {
  const selectedId = useSyncExternalStore(
    subscribeToLevelSelection,
    selectedLevelSnapshot,
    () => defaultCurriculumLevel,
  );
  const [openUnitSelection, setOpenUnitSelection] = useState({
    levelId: defaultCurriculumLevel,
    unitId: "fraction-operations" as string | null,
  });
  const [bookingOpen, setBookingOpen] = useState(false);
  const levelButtons = useRef<Array<HTMLButtonElement | null>>([]);
  const bookingReturnFocus = useRef<HTMLElement | null>(null);
  const selectedLevel = getLevel(selectedId);
  const openUnitId =
    openUnitSelection.levelId === selectedId
      ? openUnitSelection.unitId
      : (selectedLevel.units[0]?.id ?? null);

  function selectLevel(levelId: string) {
    if (!curriculumById.has(levelId)) return;
    const url = new URL(window.location.href);
    url.searchParams.set("level", levelId);
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    window.dispatchEvent(new Event(levelSelectionEvent));
  }

  function openBooking(trigger: HTMLElement) {
    bookingReturnFocus.current = trigger;
    setBookingOpen(true);
  }

  function closeBooking() {
    setBookingOpen(false);
    window.requestAnimationFrame(() => bookingReturnFocus.current?.focus());
  }

  function handleLevelKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = (index + 1) % mathematicsCurriculum.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = (index - 1 + mathematicsCurriculum.length) % mathematicsCurriculum.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = mathematicsCurriculum.length - 1;
    }
    if (nextIndex === null) return;
    event.preventDefault();
    const nextLevel = mathematicsCurriculum[nextIndex];
    if (!nextLevel) return;
    selectLevel(nextLevel.id);
    levelButtons.current[nextIndex]?.focus();
  }

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>Mathematics · Grades 1–Precalculus</p>
            <h1>Build strong math skills, one clear step at a time.</h1>
            <p className={styles.heroLede}>
              Personalized live lessons help students strengthen foundations, master grade-level
              skills, and confidently move toward advanced mathematics.
            </p>
            <p className={styles.heroPrompt}>
              Choose your child&apos;s grade to see the exact skills, topics, and learning
              milestones included in the program.
            </p>
            <div className={styles.heroActions}>
              <a className={styles.primaryButton} href="#curriculum-explorer">
                Explore the curriculum <ArrowRight aria-hidden="true" />
              </a>
              <button
                className={styles.secondaryButton}
                type="button"
                onClick={(event) => openBooking(event.currentTarget)}
              >
                Book a free class
              </button>
            </div>
            <div className={styles.trustGrid} aria-label="Program assurances">
              <span>
                <CircleCheck aria-hidden="true" /> Grade-aligned curriculum
              </span>
              <span>
                <Target aria-hidden="true" /> Personalized learning plan
              </span>
              <span>
                <UserRoundCheck aria-hidden="true" /> Verified mathematics tutors
              </span>
              <span>
                <MessageSquareText aria-hidden="true" /> Feedback after every lesson
              </span>
            </div>
            <p className={styles.supportLine}>
              <Sparkles aria-hidden="true" /> Built for students catching up, staying on track, or
              moving ahead.
            </p>
          </div>

          <JourneyPreview selectedLevel={selectedLevel} onSelect={selectLevel} />
        </div>
      </section>

      <section className={styles.explorer} id="curriculum-explorer">
        <div className={styles.container}>
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.kicker}>Your child&apos;s learning path</p>
              <h2>Choose a grade or course</h2>
            </div>
            <p>
              See what students learn, why it matters, and how each level prepares them for what
              comes next.
            </p>
          </div>

          <div className={styles.levelNavigator} role="tablist" aria-label="Mathematics levels">
            {curriculumGroups.map((group) => (
              <div className={styles.levelGroup} key={group.id} role="presentation">
                <p>{group.label}</p>
                <div className={styles.levelRail} role="presentation">
                  {mathematicsCurriculum
                    .filter((level) => level.category === group.id)
                    .map((level) => {
                      const index = mathematicsCurriculum.findIndex((item) => item.id === level.id);
                      const selected = level.id === selectedLevel.id;
                      return (
                        <button
                          aria-controls="curriculum-detail"
                          aria-selected={selected}
                          className={styles.levelButton}
                          data-selected={selected}
                          id={`level-tab-${level.id}`}
                          key={level.id}
                          onClick={() => selectLevel(level.id)}
                          onKeyDown={(event) => handleLevelKeyDown(event, index)}
                          ref={(node) => {
                            levelButtons.current[index] = node;
                          }}
                          role="tab"
                          tabIndex={selected ? 0 : -1}
                          type="button"
                        >
                          <span className={styles.levelTitle}>{level.shortTitle}</span>
                          <span className={styles.levelFocus}>{level.focus}</span>
                          <span className={styles.levelReadiness}>{level.readinessLabel}</span>
                        </button>
                      );
                    })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <CurriculumDetail
        level={selectedLevel}
        openUnitId={openUnitId}
        onOpenUnit={(unitId) => setOpenUnitSelection({ levelId: selectedId, unitId })}
        onSelectLevel={selectLevel}
        onBook={openBooking}
      />

      <section className={styles.adaptiveSection}>
        <div className={styles.container}>
          <div className={styles.adaptiveCopy}>
            <p className={styles.kicker}>One curriculum, three starting points</p>
            <h2>The right path starts with what your child knows today.</h2>
            <p>
              A tutor can revisit prerequisites, teach the current course, or add stretch
              work—without changing the long-term destination.
            </p>
          </div>
          <div className={styles.adaptivePath}>
            {supportGoals.map((goal, index) => (
              <div className={styles.adaptiveStep} key={goal.id}>
                <span>{index + 1}</span>
                <div>
                  <strong>{goal.label}</strong>
                  <p>{goal.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.conversionSection} id="free-class">
        <div className={styles.conversionInner}>
          <div>
            <p className={styles.kicker}>No commitment · 30 minutes</p>
            <h2>See how the right math lesson feels.</h2>
            <p>
              Tell us the level and goal. We&apos;ll match your child with a verified mathematics
              tutor for a focused free class.
            </p>
          </div>
          <div className={styles.conversionAction}>
            <button
              className={styles.lightButton}
              type="button"
              onClick={(event) => openBooking(event.currentTarget)}
            >
              Request a free class <MoveRight aria-hidden="true" />
            </button>
            <span>
              <LockKeyhole aria-hidden="true" /> About one minute. No payment details.
            </span>
          </div>
        </div>
      </section>

      <button
        className={styles.mobileCta}
        type="button"
        onClick={(event) => openBooking(event.currentTarget)}
      >
        Book a free class <ArrowRight aria-hidden="true" />
      </button>

      {bookingOpen && <BookingDialog initialLevel={selectedLevel.id} onClose={closeBooking} />}
    </div>
  );
}

function JourneyPreview({
  selectedLevel,
  onSelect,
}: {
  selectedLevel: CurriculumLevel;
  onSelect: (id: string) => void;
}) {
  const reachedStage = journeyStageFor(selectedLevel);
  const reachedIndex = journeyMilestoneIds.indexOf(reachedStage);

  return (
    <aside className={styles.journey} aria-label="Mathematics journey preview">
      <div className={styles.journeyTopline}>
        <span>Mathematics learning path</span>
        <span>01 → 13</span>
      </div>
      <div className={styles.journeyBody}>
        <div className={styles.journeyTrack}>
          <div className={styles.pathLine} aria-hidden="true" />
          {journeyMilestoneIds.map((milestoneId, index) => {
            const milestone = getLevel(milestoneId);
            const current = milestoneId === reachedStage;
            return (
              <button
                aria-label={`Show ${milestone.shortTitle} curriculum`}
                className={styles.journeyNode}
                data-current={current}
                data-reached={index <= reachedIndex}
                key={milestoneId}
                onClick={() => onSelect(milestoneId)}
                type="button"
              >
                <span aria-hidden="true">{index + 1}</span>
                <strong>{milestone.shortTitle}</strong>
              </button>
            );
          })}
        </div>
        <div className={styles.mathPreview}>
          <div className={styles.previewLabel}>
            <span>Exploring</span>
            <strong>{selectedLevel.shortTitle}</strong>
          </div>
          <MathVisual key={selectedLevel.id} level={selectedLevel} />
          <p>{selectedLevel.focus}</p>
        </div>
      </div>
      <p className={styles.journeyNote}>Each level builds the tools needed for the next.</p>
    </aside>
  );
}

function MathVisual({ level }: { level: CurriculumLevel }) {
  const levelIndex = mathematicsCurriculum.findIndex((item) => item.id === level.id);
  if (levelIndex <= 2) {
    return (
      <svg
        className={styles.mathVisual}
        viewBox="0 0 240 150"
        role="img"
        aria-label="Number blocks showing early number sense"
      >
        <title>Number blocks</title>
        {[0, 1, 2, 3, 4, 5, 6].map((block) => (
          <rect
            className={styles.visualShape}
            height="31"
            key={block}
            rx="7"
            width="31"
            x={18 + (block % 4) * 39}
            y={30 + Math.floor(block / 4) * 39}
          />
        ))}
        <text className={styles.visualText} x="181" y="70">
          7
        </text>
        <text className={styles.visualFormula} x="18" y="132">
          4 + 3 = 7
        </text>
      </svg>
    );
  }
  if (levelIndex <= 4) {
    return (
      <svg
        className={styles.mathVisual}
        viewBox="0 0 240 150"
        role="img"
        aria-label="Fraction bar model"
      >
        <title>Fraction model</title>
        <rect className={styles.visualShape} height="42" rx="7" width="180" x="20" y="32" />
        <path className={styles.visualCut} d="M65 32v42M110 32v42M155 32v42" />
        <path className={styles.visualFill} d="M20 32h90v42H20z" />
        <text className={styles.visualFormula} x="20" y="124">
          1/2 = 2/4
        </text>
      </svg>
    );
  }
  if (levelIndex <= 8) {
    return (
      <svg
        className={styles.mathVisual}
        viewBox="0 0 240 150"
        role="img"
        aria-label="Coordinate plane with a linear graph"
      >
        <title>Coordinate plane</title>
        <path
          className={styles.visualGrid}
          d="M35 20v105M75 20v105M115 20v105M155 20v105M195 20v105M20 35h195M20 70h195M20 105h195"
        />
        <path className={styles.visualAxis} d="M20 105h200M75 132V15" />
        <path className={styles.visualGraph} d="M35 117L195 31" />
        <circle className={styles.visualPoint} cx="115" cy="74" r="6" />
      </svg>
    );
  }
  if (level.id === "geometry") {
    return (
      <svg
        className={styles.mathVisual}
        viewBox="0 0 240 150"
        role="img"
        aria-label="Triangle with a proof relationship"
      >
        <title>Triangle proof</title>
        <path className={styles.visualGraph} d="M36 119L112 25l91 94z" />
        <path className={styles.visualCut} d="M112 25v94" />
        <path className={styles.visualAngle} d="M91 119a21 21 0 0 1 21-21" />
        <text className={styles.visualFormula} x="133" y="82">
          a² + b² = c²
        </text>
      </svg>
    );
  }
  if (level.id === "precalculus") {
    return (
      <svg
        className={styles.mathVisual}
        viewBox="0 0 240 150"
        role="img"
        aria-label="Trigonometric function graph"
      >
        <title>Function graph</title>
        <path
          className={styles.visualGrid}
          d="M20 35h200M20 75h200M20 115h200M50 20v110M110 20v110M170 20v110"
        />
        <path className={styles.visualAxis} d="M20 75h205M50 135V15" />
        <path className={styles.visualGraph} d="M20 75c23-56 45-56 68 0s45 56 68 0 45-56 68 0" />
      </svg>
    );
  }
  return (
    <svg
      className={styles.mathVisual}
      viewBox="0 0 240 150"
      role="img"
      aria-label="Algebraic function equation and graph"
    >
      <title>Algebra equation</title>
      <path
        className={styles.visualGrid}
        d="M20 35h200M20 75h200M20 115h200M50 20v110M110 20v110M170 20v110"
      />
      <path className={styles.visualAxis} d="M20 115h205M50 135V15" />
      <path className={styles.visualGraph} d="M29 121L198 26" />
      <text className={styles.visualFormula} x="113" y="129">
        y = 2x − 1
      </text>
    </svg>
  );
}

function CurriculumDetail({
  level,
  openUnitId,
  onOpenUnit,
  onSelectLevel,
  onBook,
}: {
  level: CurriculumLevel;
  openUnitId: string | null;
  onOpenUnit: (id: string | null) => void;
  onSelectLevel: (id: string) => void;
  onBook: (trigger: HTMLElement) => void;
}) {
  const nextLevel = level.nextLevel ? curriculumById.get(level.nextLevel) : undefined;

  return (
    <section
      aria-labelledby={`level-tab-${level.id}`}
      className={styles.curriculumDetail}
      id="curriculum-detail"
      role="tabpanel"
    >
      <div className={styles.container}>
        <div className={styles.curriculumIntro}>
          <div>
            <p className={styles.levelNumber}>
              Level{" "}
              {String(mathematicsCurriculum.findIndex((item) => item.id === level.id) + 1).padStart(
                2,
                "0",
              )}{" "}
              of {mathematicsCurriculum.length}
            </p>
            <h2 aria-live="polite">{level.title}</h2>
            <p>{level.summary}</p>
          </div>
          <button
            className={styles.inlineBookButton}
            type="button"
            onClick={(event) => onBook(event.currentTarget)}
          >
            Try this level free <ArrowRight aria-hidden="true" />
          </button>
        </div>

        <div className={styles.bestFor}>
          <strong>Best for</strong>
          {level.bestFor.map((item) => (
            <span key={item}>
              <Check aria-hidden="true" /> {item}
            </span>
          ))}
        </div>

        <div className={styles.curriculumSectionHeading}>
          <div>
            <p className={styles.kicker}>Curriculum sequence</p>
            <h3>{level.units.length} connected learning units</h3>
          </div>
          <p>Open any unit to see the exact topics your child will learn.</p>
        </div>

        <div className={styles.unitPath}>
          {level.units.map((curriculumUnit, index) => {
            const expanded = openUnitId === curriculumUnit.id;
            const panelId = `${level.id}-${curriculumUnit.id}-panel`;
            return (
              <article className={styles.unit} data-expanded={expanded} key={curriculumUnit.id}>
                <button
                  aria-controls={panelId}
                  aria-expanded={expanded}
                  className={styles.unitButton}
                  onClick={() => onOpenUnit(expanded ? null : curriculumUnit.id)}
                  type="button"
                >
                  <span className={styles.unitNumber}>{String(index + 1).padStart(2, "0")}</span>
                  <span className={styles.unitMain}>
                    <strong>{curriculumUnit.title}</strong>
                    <span>{curriculumUnit.summary}</span>
                  </span>
                  <span className={styles.unitPosition}>
                    Unit {index + 1} of {level.units.length}
                  </span>
                  <ChevronDown className={styles.unitChevron} aria-hidden="true" />
                </button>
                {expanded && (
                  <div className={styles.unitPanel} id={panelId}>
                    <div>
                      <p className={styles.detailLabel}>Students learn to</p>
                      <ul>
                        {curriculumUnit.skills.map((skill) => (
                          <li key={skill}>
                            <Check aria-hidden="true" /> {skill}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className={styles.dependency}>
                      <span>
                        <ShieldCheck aria-hidden="true" /> Readiness checkpoint
                      </span>
                      <strong>{curriculumUnit.dependency}</strong>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>

        <div className={styles.readinessGrid}>
          <div className={styles.outcomes}>
            <p className={styles.kicker}>Learning outcomes</p>
            <h3>By the end of {level.shortTitle}, students should be able to…</h3>
            <ul>
              {level.outcomes.map((outcome) => (
                <li key={outcome}>
                  <CircleCheck aria-hidden="true" /> {outcome}
                </li>
              ))}
            </ul>
          </div>
          <div className={styles.prerequisites}>
            <p className={styles.kicker}>Readiness check</p>
            <h3>Skills your child should already know</h3>
            <div className={styles.prerequisiteChips}>
              {level.prerequisites.map((skill) => (
                <span key={skill}>{skill}</span>
              ))}
            </div>
            <p>Not sure whether your child is ready?</p>
            <a href={`/${useLocale()}/free-assessment`}>
              Take a free placement assessment <ArrowRight aria-hidden="true" />
            </a>
          </div>
        </div>

        {nextLevel && (
          <div className={styles.nextLevel}>
            <div className={styles.nextMarker} aria-hidden="true">
              <ArrowRight />
            </div>
            <div>
              <p>What comes next</p>
              <h3>Next step: {nextLevel.title}</h3>
              <span>{level.nextDescription}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                onSelectLevel(nextLevel.id);
                window.requestAnimationFrame(() => {
                  document.getElementById("curriculum-detail")?.scrollIntoView({ block: "start" });
                });
              }}
            >
              Preview {nextLevel.shortTitle} <ArrowRight aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

function BookingDialog({ initialLevel, onClose }: { initialLevel: string; onClose: () => void }) {
  const locale = useLocale();
  const [step, setStep] = useState(1);
  const [levelId, setLevelId] = useState(initialLevel);
  const [goal, setGoal] = useState<SupportGoal>("on-track");
  const [status, setStatus] = useState<FormStatus>("idle");
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          "button:not([disabled]), input:not([disabled]), select:not([disabled]), a[href]",
        ),
      );
      if (!focusable.length) return;
      const first = focusable.at(0);
      const last = focusable.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const selectedLevel = getLevel(levelId);
  const selectedGoal = getSupportGoal(goal);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "trial_class",
          parentName: values.parentName,
          email: values.email,
          phone: "",
          learnerAgeBand: ageBandFor(levelId),
          interest: `${selectedLevel.title} · ${selectedGoal.label}`,
          message: `Learning goal: ${selectedGoal.detail}`,
          locale,
          privacyConsent: values.privacyConsent === "on",
          company: values.company ?? "",
        }),
      });
      setStatus(response.ok ? "sent" : "error");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div
      className={styles.dialogBackdrop}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        aria-describedby="booking-description"
        aria-labelledby="booking-title"
        aria-modal="true"
        className={styles.dialog}
        ref={dialogRef}
        role="dialog"
      >
        <button
          aria-label="Close booking form"
          className={styles.dialogClose}
          onClick={onClose}
          ref={closeButtonRef}
          type="button"
        >
          <X aria-hidden="true" />
        </button>
        {status === "sent" ? (
          <div className={styles.formSuccess} role="status">
            <span>
              <CircleCheck aria-hidden="true" />
            </span>
            <p className={styles.kicker}>Request received</p>
            <h2 id="booking-title">Your free class is one step closer.</h2>
            <p id="booking-description">
              We&apos;ll email you to arrange a time and confirm the best starting point for{" "}
              {selectedLevel.shortTitle}.
            </p>
            <button className={styles.primaryButton} onClick={onClose} type="button">
              Done
            </button>
          </div>
        ) : (
          <>
            <div className={styles.dialogHeader}>
              <p className={styles.kicker}>Free 30-minute mathematics class</p>
              <h2 id="booking-title">A few details. No long form.</h2>
              <p id="booking-description">We only ask what we need to match your child well.</p>
              <div className={styles.stepProgress} aria-label={`Step ${step} of 2`}>
                <span data-active={step >= 1}>
                  1 <em>Learning fit</em>
                </span>
                <span data-active={step >= 2}>
                  2 <em>Your details</em>
                </span>
              </div>
            </div>
            {step === 1 ? (
              <div className={styles.bookingStep}>
                <label className={styles.bookingField}>
                  <span>Grade or course</span>
                  <select value={levelId} onChange={(event) => setLevelId(event.target.value)}>
                    {mathematicsCurriculum.map((level) => (
                      <option key={level.id} value={level.id}>
                        {level.shortTitle}
                      </option>
                    ))}
                  </select>
                </label>
                <fieldset className={styles.goalFieldset}>
                  <legend>What kind of support would help most?</legend>
                  {supportGoals.map((item) => (
                    <label data-selected={goal === item.id} key={item.id}>
                      <input
                        checked={goal === item.id}
                        name="goal"
                        onChange={() => setGoal(item.id)}
                        type="radio"
                        value={item.id}
                      />
                      <span>
                        <strong>{item.label}</strong>
                        <small>{item.detail}</small>
                      </span>
                    </label>
                  ))}
                </fieldset>
                <button className={styles.primaryButton} onClick={() => setStep(2)} type="button">
                  Continue <ArrowRight aria-hidden="true" />
                </button>
              </div>
            ) : (
              <form className={styles.bookingStep} onSubmit={submit}>
                <div className={styles.formSummary}>
                  <ClipboardCheck aria-hidden="true" />
                  <span>
                    <strong>{selectedLevel.shortTitle}</strong>
                    {selectedGoal.label}
                  </span>
                  <button type="button" onClick={() => setStep(1)}>
                    Edit
                  </button>
                </div>
                <label className={styles.bookingField}>
                  <span>Parent or guardian name</span>
                  <input autoComplete="name" maxLength={120} name="parentName" required />
                </label>
                <label className={styles.bookingField}>
                  <span>Email address</span>
                  <input autoComplete="email" maxLength={254} name="email" required type="email" />
                </label>
                <div className={styles.honeypot} aria-hidden="true">
                  <label>
                    Company
                    <input autoComplete="off" name="company" tabIndex={-1} />
                  </label>
                </div>
                <label className={styles.formConsent}>
                  <input name="privacyConsent" required type="checkbox" />
                  <span>
                    I agree that 2tor may contact me about this class. My details are handled
                    according to the privacy policy.
                  </span>
                </label>
                {status === "error" && (
                  <p className={styles.formError} role="alert">
                    We couldn&apos;t send your request. Check your connection and try again.
                  </p>
                )}
                <div className={styles.formActions}>
                  <button className={styles.backButton} onClick={() => setStep(1)} type="button">
                    Back
                  </button>
                  <button
                    className={styles.primaryButton}
                    disabled={status === "sending"}
                    type="submit"
                  >
                    {status === "sending" ? "Sending…" : "Request my free class"}
                  </button>
                </div>
                <p className={styles.privacyNote}>
                  <LockKeyhole aria-hidden="true" /> No payment details. No student name or birth
                  date needed.
                </p>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
