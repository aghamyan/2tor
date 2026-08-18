import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  BookOpenCheck,
  BrainCircuit,
  CalendarDays,
  Check,
  Eye,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  GraduationCap,
  Lightbulb,
  LockKeyhole,
  MessageCircleMore,
  Network,
  NotebookPen,
  Play,
  Route,
  ShieldCheck,
  Sparkles,
  Target,
  UserRoundCheck,
  Users,
  Waypoints,
  X,
} from "lucide-react";
import type { Locale } from "@app/i18n/config";
import { getHowItWorksCopy } from "./how-it-works-content";
import { KnowledgeMap, LearningLogic, RecordTabs, Reveal } from "./how-it-works-interactive";
import { headerButtonClass } from "../site/header-actions";
import { ArrowUpRightIcon } from "../site/icons";
import siteStyles from "../site/site.module.css";
import { SectionGround } from "../section-ground";
import { SectionEyebrow, accentedTitle, type SectionTone } from "../section-heading";
import styles from "./how-it-works.module.css";

/**
 * The two ratios a chip's spoke needs to start outside the card: 1/|cos| and 1/|sin| of its angle.
 *
 * The chips are glass, so a spoke that begins under one draws a line across the inside of the card.
 * Clearing it is not one distance for all six — a card presents a different edge to the centre
 * depending on where it sits, its side at three and nine o'clock and its cap at the four diagonals.
 *
 * What crosses the language boundary is these two ratios rather than a finished length, because the
 * chips are sized in `clamp()` and a length resolved here would be right at exactly one viewport
 * width. The stylesheet multiplies them by whatever half-width and half-height the chip currently
 * has and takes the smaller — see `--reach` in `.orbit > span`.
 *
 * The cap stands in for infinity: a horizontal ray never meets the horizontal edges, so that side
 * of the `min()` must simply lose. `Infinity` itself would serialise into CSS as an invalid value
 * and take the whole declaration with it.
 */
function orbitRatios(index: number) {
  const angle = (index * 60 * Math.PI) / 180;
  return {
    "--kw": Math.min(1 / Math.abs(Math.cos(angle)), 1000),
    "--kh": Math.min(1 / Math.abs(Math.sin(angle)), 1000),
  };
}

/*
 * Positional, matching `hero.outcomes` order. Three distinct icons rather than three repeated
 * checkmarks: each names a different kind of outcome, and a row of identical ticks would throw that
 * distinction away.
 */
const outcomeIcons = [BookOpenCheck, Eye, Users] as const;

/*
 * Column spans for the parent workspace's eight tiles, over a six-column grid — positional, matching
 * `parents.fields` order.
 *
 * The grid used to be three equal columns with two tiles widened to `span 2`, which left the eighth
 * tile alone on a fourth row beside two columns of nothing. Eight tiles do not divide into three.
 * Six columns do divide by both 2 and 3, so the same eight tiles close four full rows, and the
 * grouping can follow the week rather than the arithmetic:
 *
 *   what happened   topic · attendance · homework
 *   where they are  current goal · skills developing
 *   what was said   latest feedback · next lesson
 *   what changes    plan update, full width, as the row the other three lead to
 */
const dashboardSpans = [2, 2, 2, 3, 3, 3, 3, 6] as const;

/**
 * One student card on the match board. `index` supplies the letter, so the A/B/C in the drawing and
 * the A/B/C in `match.compatible` and `match.wait` cannot drift apart. `held` marks the student who
 * is not placed in this group — it is the same card at a quieter weight, not a different one.
 */
function MatchStudent({
  student,
  index,
  held = false,
}: {
  /* `match.students` is inferred as `string[][]` from the copy record, so this stays a plain array
     rather than a tuple — narrowing it here would only push the cast up to the call site. */
  student: readonly string[];
  index: number;
  held?: boolean;
}) {
  return (
    <article data-held={held || undefined} data-student={index}>
      <span>{String.fromCharCode(65 + index)}</span>
      <div>
        <small>{student[0]}</small>
        <strong>{student[1]}</strong>
        <p>{student[2]}</p>
        <p>
          <CalendarDays />
          {student[3]}
        </p>
      </div>
    </article>
  );
}

function localHref(locale: Locale, path: string) {
  return `/${locale}${path}`;
}

/**
 * A section opener: eyebrow, heading, supporting sentence.
 *
 * `tone` picks the register for the eyebrow and the accent run — `pine` on the three filled blocks,
 * `paper` everywhere else. It is not a colour: ink hairlines and vermillion both disappear on the
 * dark block, which is why the shared component takes a register rather than letting callers pass
 * a colour and get it wrong.
 *
 * `titleAccent` is optional. Where present it colours the phrase that carries the section's claim,
 * the same treatment every home-page heading uses; where absent the heading renders whole.
 */
function Heading({
  eyebrow,
  title,
  titleAccent,
  body,
  tone = "paper",
  inverse = false,
}: {
  eyebrow?: string;
  title: string;
  titleAccent?: string;
  body?: string;
  tone?: SectionTone;
  inverse?: boolean;
}) {
  return (
    <div className={`${styles.heading} ${inverse ? styles.inverse : ""}`}>
      {eyebrow && (
        <SectionEyebrow tone={tone} className={styles.eyebrowSlot}>
          {eyebrow}
        </SectionEyebrow>
      )}
      <h2>{titleAccent ? accentedTitle(title, titleAccent, tone) : title}</h2>
      {body && <div>{body}</div>}
    </div>
  );
}

function ProfileVisual({ c }: { c: ReturnType<typeof getHowItWorksCopy>["profile"] }) {
  return (
    <div
      className={styles.profileVisual}
      role="img"
      aria-label={`${c.student}. ${c.signals.map((x) => x.join(": ")).join(". ")}. Outputs: ${c.outputs.join(", ")}.`}
    >
      <div className={styles.visualTop}>
        <span>
          <i />
          {c.label}
        </span>
        <small>{c.student}</small>
      </div>
      <div className={styles.signalGrid}>
        {c.signals.map(([label, value], index) => (
          <div
            className={styles.signal}
            style={{ "--delay": `${index * 90}ms` } as React.CSSProperties}
            key={label}
          >
            <small>{label}</small>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <div className={styles.recordCore}>
        <span>
          <BrainCircuit aria-hidden="true" />
        </span>
        <div>
          <small>2tor</small>
          <strong>{c.record}</strong>
        </div>
        <i aria-hidden="true" />
      </div>
      <div className={styles.outputRail}>
        {c.outputs.map((output, index) => (
          <div style={{ "--delay": `${900 + index * 120}ms` } as React.CSSProperties} key={output}>
            {index === 0 ? <NotebookPen /> : index === 1 ? <MessageCircleMore /> : <Users />}
            <span>{output}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function HowItWorksPage({ locale }: { locale: Locale }) {
  const c = getHowItWorksCopy(locale);
  const consultation = localHref(locale, "/consultation");
  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroGrid} aria-hidden="true" />
        <div className={styles.shell}>
          <div className={styles.heroLayout}>
            <div className={styles.heroCopy}>
              <SectionEyebrow>{c.hero.eyebrow}</SectionEyebrow>
              <h1>{accentedTitle(c.hero.title, c.hero.titleAccent)}</h1>
              <p className={styles.heroLede}>{c.hero.body}</p>

              {/*
               * Three outcomes, replacing a second paragraph that restated the lede above it. Same
               * shape as the home hero's differentiator row — icon, short label — so the two front
               * doors introduce the product the same way.
               */}
              <ul className={styles.heroOutcomes}>
                {c.hero.outcomes.map((item, index) => {
                  const Icon = outcomeIcons[index] ?? Check;
                  return (
                    <li key={item}>
                      <Icon size={17} aria-hidden="true" />
                      {item}
                    </li>
                  );
                })}
              </ul>

              <div className={styles.actions}>
                {/*
                 * The header's own button, not a copy of it. `headerButtonClass` and
                 * `.buttonPrimary` are the exact two classes `HeaderActionsPanel` composes, so the
                 * accent pill, the travelling sheen, the arrow badge and the destination stay in
                 * sync by construction — the home hero does the same.
                 *
                 * `.scope` has to come along: it is where `site.module.css` declares the `--site-*`
                 * tokens `.buttonPrimary` paints with, and outside the site chrome they would
                 * resolve to nothing and the button would render as bare text.
                 */}
                <Link
                  href={consultation}
                  className={`${siteStyles.scope} ${siteStyles.buttonPrimary} ${headerButtonClass} ${styles.heroConsultAction}`}
                >
                  {c.hero.primary}
                  <ArrowUpRightIcon className={siteStyles.buttonIcon} />
                </Link>
                <a className={styles.secondary} href="#learning-system">
                  {c.hero.secondaryCta}
                  <ArrowDown />
                </a>
              </div>
              <p className={styles.reassurance}>
                <CheckCircle2 />
                {c.hero.note}
              </p>
              <ul className={styles.trust}>
                {c.hero.trust.map((item) => (
                  <li key={item}>
                    <Check />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <ProfileVisual c={c.profile} />
          </div>
        </div>
      </section>

      <section className={styles.evidenceSection} id="learning-system">
        <SectionGround tone="paper" mask="radial-gradient(110% 85% at 50% 40%, black 24%, transparent 76%)" />
        <div className={styles.shell}>
          <Reveal>
            <Heading eyebrow={c.evidence.eyebrow} title={c.evidence.title} titleAccent={c.evidence.titleAccent} body={c.evidence.body} />
            <ol className={styles.evidencePath}>
              {c.evidence.items.map((item, index) => (
                <li key={item}>
                  <span>0{index + 1}</span>
                  <strong>{item}</strong>
                  {index < c.evidence.items.length - 1 && <ArrowRight aria-hidden="true" />}
                </li>
              ))}
            </ol>
          </Reveal>
        </div>
      </section>

      <section className={styles.understandSection} id="understand">
        <SectionGround
          tone="paper"
          mask="radial-gradient(115% 90% at 32% 46%, black 26%, transparent 78%)"
          blooms={[
            styles.understandBloomOne,
            styles.understandBloomTwo,
            styles.understandBloomThree,
          ]}
        />
        <div className={styles.shell}>
          <Reveal>
            <div className={styles.headingRow}>
              <Heading
                eyebrow={c.understand.eyebrow}
                title={c.understand.title} titleAccent={c.understand.titleAccent}
                body={c.understand.body}
              />
              <aside>
                <Lightbulb />
                {c.understand.note}
              </aside>
            </div>
            <KnowledgeMap c={c.understand} />
          </Reveal>
        </div>
      </section>

      <section className={styles.recordSection} id="record">
        <SectionGround
          tone="paper"
          mask="radial-gradient(110% 88% at 62% 44%, black 24%, transparent 76%)"
          blooms={[styles.recordBloomOne, styles.recordBloomTwo]}
        />
        <div className={styles.shell}>
          <Reveal className={styles.recordLayout}>
            <div>
              <Heading eyebrow={c.record.eyebrow} title={c.record.title} titleAccent={c.record.titleAccent} />
              <ol className={styles.activityFeed}>
                {c.record.feed.map((item, index) => (
                  <li key={item}>
                    <span>
                      {index === 0 ? (
                        <CalendarDays />
                      ) : index === 1 ? (
                        <Target />
                      ) : index === 2 ? (
                        <BookOpenCheck />
                      ) : index === 3 ? (
                        <MessageCircleMore />
                      ) : index === 4 ? (
                        <ClipboardCheck />
                      ) : (
                        <Route />
                      )}
                    </span>
                    <div>
                      <small>0{index + 1}</small>
                      <strong>{item}</strong>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
            <RecordTabs c={c.record} />
          </Reveal>
        </div>
      </section>

      <section className={styles.prepareSection} id="prepare">
        {/*
         * Blooms are not decoration here — they are what the workspace panel and the two comparison
         * cards refract. `globals.css` states the test: a glass surface over flat paper would look
         * identical with `backdrop-filter: none`, which makes it a tinted div. This section had no
         * blooms at all before the glass went on.
         */}
        <SectionGround
          tone="paper"
          mask="radial-gradient(112% 88% at 38% 48%, black 22%, transparent 76%)"
          blooms={[styles.prepBloomOne, styles.prepBloomTwo]}
        />
        <div className={styles.shell}>
          <Reveal>
            <Heading eyebrow={c.prepare.eyebrow} title={c.prepare.title} titleAccent={c.prepare.titleAccent} body={c.prepare.body} />
            <div className={styles.prepWorkspace}>
              <div className={styles.prepSidebar}>
                <div className={styles.workspaceTop}>
                  <span>
                    <i />
                    Tutor preparation
                  </span>
                  <small>{c.common.example}</small>
                </div>
                {c.prepare.inputs.map(([label, value], index) => (
                  <div
                    className={styles.prepInput}
                    style={{ "--delay": `${index * 90}ms` } as React.CSSProperties}
                    key={label}
                  >
                    <Check />
                    <span>
                      <small>{label}</small>
                      <strong>{value}</strong>
                    </span>
                  </div>
                ))}
              </div>
              <div className={styles.objectiveCard}>
                <p>{c.common.lessonObjective}</p>
                <h3>{c.prepare.objective}</h3>
                <div className={styles.objectiveSteps}>
                  <span>
                    <i>1</i>Visual model
                  </span>
                  <ArrowRight />
                  <span>
                    <i>2</i>Guided symbols
                  </span>
                  <ArrowRight />
                  <span>
                    <i>3</i>Independent check
                  </span>
                </div>
                <div className={styles.materials}>
                  <FileText />
                  <span>Prepared materials</span>
                  <strong>3 items</strong>
                </div>
              </div>
            </div>
            <div className={styles.comparison}>
              <article>
                <small>{c.common.without}</small>
                {c.prepare.without.map((item) => (
                  <p key={item}>
                    <span>×</span>
                    {item}
                  </p>
                ))}
              </article>
              <article>
                <small>{c.common.with}</small>
                {c.prepare.with.map((item) => (
                  <p key={item}>
                    <Check />
                    {item}
                  </p>
                ))}
              </article>
            </div>
          </Reveal>
        </div>
      </section>

      <section className={styles.teachSection} id="teach">
        {/* Same reason as `03 · Prepare`: the classroom panel is glass now, and glass over flat
            paper is a tinted div. These are what it refracts. */}
        <SectionGround
          tone="paper"
          mask="radial-gradient(110% 90% at 55% 42%, black 24%, transparent 78%)"
          blooms={[styles.teachBloomOne, styles.teachBloomTwo]}
        />
        <div className={styles.shell}>
          <Reveal>
            <div className={styles.headingRow}>
              <Heading eyebrow={c.teach.eyebrow} title={c.teach.title} titleAccent={c.teach.titleAccent} />
              <div className={styles.lessonGoal}>
                <Target />
                <span>
                  <small>{c.teach.goal}</small>
                  <strong>{c.teach.goalValue}</strong>
                </span>
              </div>
            </div>
            <div className={styles.classroom}>
              <div className={styles.classroomTop}>
                <span>
                  <i />
                  Live learning workspace
                </span>
                <span>42:18</span>
              </div>
              <div className={styles.classroomBody}>
                <aside>
                  <div>
                    <span>T</span>
                    <small>{c.teach.tutor}</small>
                  </div>
                  <div>
                    <span>A</span>
                    <small>{c.teach.student}</small>
                  </div>
                  <p>
                    <MessageCircleMore />
                    {c.teach.notes}
                  </p>
                </aside>
                <div className={styles.whiteboard}>
                  <small>Shared whiteboard · Fractions</small>
                  {/* `data-part` rather than `:nth-of-type`: the two terms are colour-matched to
                      their shaded runs in the bar model below, and a positional selector would hand
                      that colour to the wrong term the moment anyone edits this expression. */}
                  <div className={styles.fraction}>
                    <span data-part="a">1/3</span>
                    <b>+</b>
                    <span data-part="b">1/4</span>
                    <b>=</b>
                    <strong>?</strong>
                  </div>
                  {/*
                   * The bar model, and why there are twelve of these rather than seven.
                   *
                   * Seven segments were the ANSWER with the working thrown away — 1/3 and 1/4 are
                   * 4/12 and 3/12, and the whole point of a visual model is showing the common unit
                   * that makes them addable. A whole bar of twelve with four shaded, three shaded
                   * and five left empty is the step the lesson is actually teaching; seven filled
                   * boxes were just a result.
                   */}
                  <div className={styles.barModel} data-model="twelfths">
                    {Array.from({ length: 12 }, (_, index) => (
                      <i key={index} data-part={index < 4 ? "a" : index < 7 ? "b" : "rest"} />
                    ))}
                  </div>
                  <div className={styles.confidence}>
                    <span>{c.teach.confidence}</span>
                    <em>Need another example</em>
                    <em>Ready to try</em>
                  </div>
                </div>
              </div>
            </div>
            <ol className={styles.lessonRail}>
              {c.teach.flow.map((item, index) => (
                <li key={item}>
                  <span>0{index + 1}</span>
                  <strong>{item}</strong>
                </li>
              ))}
            </ol>
          </Reveal>
        </div>
      </section>

      <section className={styles.betweenSection} id="continue">
        {/* The orbit's chips are glass; these are what they refract. Both sit on the right, under
            the diagram — a bloom behind the headline on the left would only cost it contrast. */}
        <SectionGround
          tone="paper"
          mask="radial-gradient(115% 88% at 40% 50%, black 26%, transparent 76%)"
          blooms={[styles.betweenBloomOne, styles.betweenBloomTwo]}
        />
        <div className={styles.shell}>
          <Reveal className={styles.betweenLayout}>
            {/* Sticky, matching `.formIntro` in group lessons' "Join the list": the copy holds at
                the top of the viewport while the diagram beside it scrolls past. */}
            <div className={styles.betweenCopy}>
              <Heading eyebrow={c.between.eyebrow} title={c.between.title} titleAccent={c.between.titleAccent} body={c.between.body} />
            </div>
            <div>
              <div
                className={styles.orbit}
                role="img"
                aria-label={`${c.between.center}: ${c.between.items.join(", ")}`}
              >
                <div className={styles.orbitCenter}>
                  <Play />
                  <strong>{c.between.center}</strong>
                  <small>Fractions · 50 min</small>
                </div>
                {c.between.items.map((item, index) => (
                  <span
                    style={
                      { "--i": index, ...orbitRatios(index) } as React.CSSProperties
                    }
                    key={item}
                  >
                    {index === 0 ? (
                      <BookOpenCheck />
                    ) : index === 1 ? (
                      <FileText />
                    ) : index === 2 ? (
                      <MessageCircleMore />
                    ) : index === 3 ? (
                      <Lightbulb />
                    ) : index === 4 ? (
                      <Users />
                    ) : (
                      <CalendarDays />
                    )}
                    <b>{item}</b>
                  </span>
                ))}
              </div>
              <p className={styles.orbitNote}>
                <MessageCircleMore />
                {c.between.note}
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      <section className={styles.parentSection} id="inform">
        <SectionGround
          tone="paper"
          mask="radial-gradient(110% 88% at 58% 46%, black 24%, transparent 76%)"
          blooms={[styles.informBloomOne, styles.informBloomTwo]}
        />
        <div className={styles.shell}>
          <Reveal className={styles.parentLayout}>
            <div>
              <Heading eyebrow={c.parents.eyebrow} title={c.parents.title} titleAccent={c.parents.titleAccent} body={c.parents.body} />
              {/*
               * Two faces, one label. The second carries the accent fill and its own paper-coloured
               * text, and the hover wipes a clip-path across it — so each glyph changes colour at
               * the instant the fill's edge reaches it, instead of sitting half on white and half on
               * vermillion for the length of the transition. See `.exploreAction`.
               *
               * `aria-hidden` on the copy: the accessible name must stay one label, not two.
               */}
              <Link className={styles.exploreAction} href={localHref(locale, "/parents")}>
                <span className={styles.exploreFace}>
                  {c.parents.cta}
                  <ArrowRight />
                </span>
                <span className={styles.exploreFace} data-fill="true" aria-hidden="true">
                  {c.parents.cta}
                  <ArrowRight />
                </span>
              </Link>
            </div>
            <div className={styles.parentDashboard}>
              <div className={styles.dashboardTop}>
                <span>
                  <i />
                  {c.common.parentView}
                </span>
                <span className={styles.avatar}>A</span>
              </div>
              <div className={styles.dashboardGrid}>
                {c.parents.fields.map(([label, value], index) => (
                  <div data-span={dashboardSpans[index] ?? 2} key={label}>
                    <small>{label}</small>
                    <strong>{value}</strong>
                    {index === 4 && (
                      <div className={styles.skillSegments}>
                        <span aria-hidden="true">
                          {Array.from({ length: c.parents.progress.total }, (_, step) => (
                            <i data-on={step < c.parents.progress.filled} key={step} />
                          ))}
                        </span>
                        <small>{c.parents.progress.label}</small>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <p>
                <LockKeyhole />
                {c.record.privacy}
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      <section className={styles.matchSection} id="match">
        <SectionGround
          tone="pine"
          mask="radial-gradient(118% 95% at 48% 44%, black 26%, transparent 78%)"
          blooms={[styles.matchBloomOne, styles.matchBloomTwo]}
        />
        <div className={styles.shell}>
          <Reveal>
            <Heading eyebrow={c.match.eyebrow} title={c.match.title} titleAccent={c.match.titleAccent} tone="pine" body={c.match.body} />
            {/*
             * The board reads top to bottom as the argument the section is making: two students,
             * the wire that joins them, the group that results — and then, held apart below it, the
             * one who does not fit yet.
             *
             * Laid out as stacked rows, NOT as absolutely positioned nodes on a fixed-height canvas.
             * The previous version placed three cards at hardcoded percentages and drew the wire as
             * two pseudo-elements at `left: 24%; width: 27%; rotate(±16deg)` — coordinates that
             * agreed with the cards at no width at all: the lines began in mid-air and touched
             * nothing. `GroupMatchMap` on the home page records the same lesson and the same fix.
             *
             * One `role="img"`: a screen reader should hear the sentence this picture makes, not
             * walk three fake student records.
             */}
            <div
              className={styles.matchBoard}
              role="img"
              aria-label={`${c.match.compatible}. ${c.match.wait}.`}
            >
              {/*
               * The legend column: what is being compared, and — pinned to the foot of it — the
               * conclusion the comparison leads to.
               *
               * `explanation` used to sit under the board in a three-column strip beside a wrapping
               * list and a button, which is where a sentence goes to be skipped. Here it is the only
               * prose in the panel and it lands directly opposite the held card it explains, while
               * also filling a column that was four short chips and then nothing.
               */}
              <div className={styles.matchLegend}>
                <small className={styles.sampleLabel}>{c.common.example}</small>
                <div className={styles.criteriaRail}>
                  {c.match.labels.map((label, index) => (
                    <span data-negative={index === 3} key={label}>
                      {/* An icon, not a bare "×" text node — as text it took neither the flex `gap`
                          nor the `svg` sizing beside it, and sat jammed against its label. */}
                      {index === 3 ? <X /> : <Check />}
                      {label}
                    </span>
                  ))}
                </div>
                <p className={styles.matchNote}>{c.match.explanation}</p>
              </div>
              <div className={styles.matchNetwork}>
                <div className={styles.matchPair}>
                  {c.match.students.slice(0, 2).map((student, index) => (
                    <MatchStudent index={index} key={student[0]} student={student} />
                  ))}
                </div>
                {/* The wire is its own row spanning exactly the gap, so its endpoints are the
                    horizontal centres of the two cards above at every width and in both locales. */}
                <div className={styles.matchWire} aria-hidden="true" />
                <div className={styles.matchResult}>
                  <Network />
                  <strong>{c.match.compatible}</strong>
                </div>
                {/* C, held back. Its connector is dashed and fades out before it arrives — an
                    incomplete line is the plainest way to draw "not placed yet", and it puts that
                    sentence on the student it is about rather than on the group's own card. */}
                <div className={styles.matchHold}>
                  <p>{c.match.wait}</p>
                  {c.match.students.slice(2).map((student) => (
                    <MatchStudent held index={2} key={student[0]} student={student} />
                  ))}
                </div>
              </div>
            </div>
            {/* Two parts now, not three: what a group gives you, and the way in. The explanation
                moved onto the board — see `.matchLegend`. */}
            <div className={styles.matchFooter}>
              <ul>
                {c.match.benefits.map((item) => (
                  <li key={item}>
                    <Check />
                    {item}
                  </li>
                ))}
              </ul>
              <Link className={styles.secondary} href={localHref(locale, "/group-lessons")}>
                {c.match.cta}
                <ArrowRight />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      <section className={styles.verifySection} id="verify">
        <SectionGround
          tone="paper"
          mask="radial-gradient(112% 88% at 36% 46%, black 24%, transparent 76%)"
          blooms={[styles.verifyBloomOne, styles.verifyBloomTwo]}
        />
        <div className={styles.shell}>
          <Reveal>
            <div className={styles.verifyLayout}>
              {/*
               * The headline and its policy statement hold at the top of the viewport while the
               * profile and the approval path scroll past them — the construction `05 · Continue`
               * takes from group lessons' "Join the list". It only works because the right column is
               * now the tall one: the pipeline moved into it, under the card it produces.
               */}
              <div className={styles.verifyCopy}>
                <Heading eyebrow={c.verify.eyebrow} title={c.verify.title} titleAccent={c.verify.titleAccent} />
                <p className={styles.policy}>
                  <ShieldCheck />
                  {c.verify.policy}
                </p>
              </div>
              <div className={styles.verifyStack}>
              <aside className={styles.tutorProfile}>
                <div className={styles.tutorHero}>
                  <span>
                    <GraduationCap />
                  </span>
                  <div>
                    <small>{c.verify.sample}</small>
                    <strong>Mathematics tutor</strong>
                  </div>
                  <i>
                    <Check />
                    Reviewed
                  </i>
                </div>
                <dl>
                  {c.verify.profile.map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
                <p>
                  <LockKeyhole />
                  {c.common.example}
                </p>
              </aside>
              {/* The path that produced the profile above it. Under the card, not beside the
                  headline, so the column reads result-then-how rather than as two lists. */}
              <ol className={styles.verifyPipeline}>
                {c.verify.stages.map(([title, body], index) => (
                  <li key={title}>
                    <span>
                      {index === c.verify.stages.length - 1 ? <Check /> : `0${index + 1}`}
                    </span>
                    <div>
                      <strong>{title}</strong>
                      <small>{body}</small>
                    </div>
                  </li>
                ))}
              </ol>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className={styles.systemSection}>
        <SectionGround
          tone="pine"
          mask="radial-gradient(115% 95% at 52% 46%, black 24%, transparent 78%)"
          blooms={[styles.systemBloomOne, styles.systemBloomTwo]}
        />
        <div className={styles.shell}>
          <Reveal>
            <Heading title={c.system.title} titleAccent={c.system.titleAccent} tone="pine" inverse />
            <div className={styles.systemDiagram}>
              {c.system.roles.slice(0, 3).map(([role, contribution], index) => (
                <article data-role={index} key={role}>
                  <span>
                    {index === 0 ? <GraduationCap /> : index === 1 ? <UserRoundCheck /> : <Users />}
                  </span>
                  <h3>{role}</h3>
                  <p>{contribution}</p>
                </article>
              ))}
              {/*
               * The three roles feeding the system. It replaces a dashed 42rem x 18rem ellipse that
               * was drawn in `--vz-ink` on an ink-coloured block — invisible, and positioned at a
               * fixed size and offset so it agreed with the cards at no width at all. This is the
               * same bracket `07 · Match` uses: verticals on the column centres, a spine, one drop.
               */}
              <div className={styles.systemWire} aria-hidden="true" />
              <article className={styles.systemCore}>
                <span>
                  <Waypoints />
                </span>
                <h3>{c.system.roles[3]?.[0]}</h3>
                <p>{c.system.roles[3]?.[1]}</p>
              </article>
            </div>
          </Reveal>
        </div>
      </section>

      <section className={styles.logicSection}>
        <SectionGround tone="paper" mask="radial-gradient(110% 88% at 44% 46%, black 24%, transparent 76%)" />
        <div className={styles.shell}>
          <Reveal>
            <Heading eyebrow={c.logic.eyebrow} title={c.logic.title} titleAccent={c.logic.titleAccent} body={c.logic.body} />
            <LearningLogic c={c.logic} />
          </Reveal>
        </div>
      </section>

      <section className={styles.curriculumSection}>
        <SectionGround tone="paper" mask="radial-gradient(112% 90% at 50% 44%, black 24%, transparent 78%)" />
        <div className={styles.shell}>
          <Reveal>
            <Heading title={c.curriculum.title} titleAccent={c.curriculum.titleAccent} />
            <div className={styles.curriculumSplit}>
              <article>
                <span>
                  <Route />
                </span>
                <h3>{c.common.curriculum}</h3>
                <ul>
                  {c.curriculum.curriculum.map((item) => (
                    <li key={item}>
                      <Check />
                      {item}
                    </li>
                  ))}
                </ul>
              </article>
              <div className={styles.plus}>+</div>
              <article>
                <span>
                  <Sparkles />
                </span>
                <h3>{c.common.personalization}</h3>
                <ul>
                  {c.curriculum.personalized.map((item) => (
                    <li key={item}>
                      <Check />
                      {item}
                    </li>
                  ))}
                </ul>
              </article>
            </div>
            <p className={styles.structureNote}>{c.curriculum.note}</p>
          </Reveal>
        </div>
      </section>

      <section className={styles.overviewSection}>
        <SectionGround tone="paper" mask="radial-gradient(110% 85% at 50% 48%, black 22%, transparent 76%)" />
        <div className={styles.shell}>
          <Reveal>
            <Heading title={c.overview.title} titleAccent={c.overview.titleAccent} />
            <ol className={styles.overviewPath}>
              {c.overview.items.map(([label, id], index) => (
                <li key={label}>
                  <a href={`#${id}`}>
                    <span>0{index + 1}</span>
                    <strong>{label}</strong>
                  </a>
                </li>
              ))}
            </ol>
          </Reveal>
        </div>
      </section>

      <section className={styles.finalSection} id="final-cta">
        <SectionGround tone="pine" mask="radial-gradient(115% 95% at 50% 46%, black 26%, transparent 78%)" />
        <div className={styles.shell}>
          <Reveal className={styles.finalPanel}>
            <div className={styles.finalIcon}>
              <BrainCircuit />
              <i />
              <i />
              <i />
            </div>
            <div>
              <h2>{accentedTitle(c.final.title, c.final.titleAccent, "pine")}</h2>
              <p>{c.final.body}</p>
              <div className={styles.actions}>
                <Link className={styles.primary} href={consultation}>
                  {c.final.primary}
                  <ArrowRight />
                </Link>
                <Link className={styles.secondary} href={localHref(locale, "/mathematics")}>
                  {c.final.secondary}
                  <BookOpenCheck />
                </Link>
              </div>
              <small>
                <CheckCircle2 />
                {c.final.note}
              </small>
            </div>
          </Reveal>
        </div>
      </section>
      <div className={styles.mobileCta}>
        <Link href={consultation}>
          {c.final.primary}
          <ArrowRight />
        </Link>
      </div>
    </div>
  );
}
