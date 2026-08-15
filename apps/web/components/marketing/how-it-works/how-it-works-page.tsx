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

/*
 * Positional, matching `hero.outcomes` order. Three distinct icons rather than three repeated
 * checkmarks: each names a different kind of outcome, and a row of identical ticks would throw that
 * distinction away.
 */
const outcomeIcons = [BookOpenCheck, Eye, Users] as const;

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
        <SectionGround tone="paper" mask="radial-gradient(110% 88% at 62% 44%, black 24%, transparent 76%)" />
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
        <SectionGround tone="paper" mask="radial-gradient(112% 88% at 38% 48%, black 22%, transparent 76%)" />
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
        <SectionGround tone="paper" mask="radial-gradient(110% 90% at 55% 42%, black 24%, transparent 78%)" />
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
                  <div className={styles.fraction}>
                    <span>1/3</span>
                    <b>+</b>
                    <span>1/4</span>
                    <b>=</b>
                    <strong>?</strong>
                  </div>
                  <div className={styles.barModel}>
                    <i />
                    <i />
                    <i />
                    <i />
                    <i />
                    <i />
                    <i />
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
        <SectionGround tone="paper" mask="radial-gradient(115% 88% at 40% 50%, black 26%, transparent 76%)" />
        <div className={styles.shell}>
          <Reveal className={styles.betweenLayout}>
            <Heading eyebrow={c.between.eyebrow} title={c.between.title} titleAccent={c.between.titleAccent} body={c.between.body} />
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
                  <span style={{ "--i": index } as React.CSSProperties} key={item}>
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
        <SectionGround tone="paper" mask="radial-gradient(110% 88% at 58% 46%, black 24%, transparent 76%)" />
        <div className={styles.shell}>
          <Reveal className={styles.parentLayout}>
            <div>
              <Heading eyebrow={c.parents.eyebrow} title={c.parents.title} titleAccent={c.parents.titleAccent} body={c.parents.body} />
              <Link className={styles.textLink} href={localHref(locale, "/parents")}>
                {c.parents.cta}
                <ArrowRight />
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
                  <div className={index === 4 || index === 5 ? styles.wideMetric : ""} key={label}>
                    <small>{label}</small>
                    <strong>{value}</strong>
                    {index === 4 && (
                      <i>
                        <b />
                      </i>
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
        <SectionGround tone="pine" mask="radial-gradient(118% 95% at 48% 44%, black 26%, transparent 78%)" />
        <div className={styles.shell}>
          <Reveal>
            <Heading eyebrow={c.match.eyebrow} title={c.match.title} titleAccent={c.match.titleAccent} tone="pine" body={c.match.body} />
            <div
              className={styles.matchBoard}
              role="img"
              aria-label={`${c.match.compatible}. ${c.match.wait}.`}
            >
              <div className={styles.criteriaRail}>
                <small className={styles.sampleLabel}>{c.common.example}</small>
                {c.match.labels.map((label, index) => (
                  <span data-negative={index === 3} key={label}>
                    {index === 3 ? "×" : <Check />}
                    {label}
                  </span>
                ))}
              </div>
              <div className={styles.studentNetwork}>
                {c.match.students.map((student, index) => (
                  <article data-student={index} key={student[0]}>
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
                ))}
                <div className={styles.matchHub}>
                  <Network />
                  <strong>{c.match.compatible}</strong>
                  <small>{c.match.wait}</small>
                </div>
              </div>
            </div>
            <div className={styles.matchFooter}>
              <p>{c.match.explanation}</p>
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
        <SectionGround tone="paper" mask="radial-gradient(112% 88% at 36% 46%, black 24%, transparent 76%)" />
        <div className={styles.shell}>
          <Reveal>
            <div className={styles.verifyLayout}>
              <div>
                <Heading eyebrow={c.verify.eyebrow} title={c.verify.title} titleAccent={c.verify.titleAccent} />
                <p className={styles.policy}>
                  <ShieldCheck />
                  {c.verify.policy}
                </p>
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
            </div>
          </Reveal>
        </div>
      </section>

      <section className={styles.systemSection}>
        <SectionGround tone="pine" mask="radial-gradient(115% 95% at 52% 46%, black 24%, transparent 78%)" />
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
