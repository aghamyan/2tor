import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  BookOpenCheck,
  BrainCircuit,
  CalendarDays,
  Check,
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
import styles from "./how-it-works.module.css";

function localHref(locale: Locale, path: string) {
  return `/${locale}${path}`;
}

function Heading({
  eyebrow,
  title,
  body,
  inverse = false,
}: {
  eyebrow?: string;
  title: string;
  body?: string;
  inverse?: boolean;
}) {
  return (
    <div className={`${styles.heading} ${inverse ? styles.inverse : ""}`}>
      {eyebrow && <p>{eyebrow}</p>}
      <h2>{title}</h2>
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
              <p className={styles.eyebrow}>{c.hero.eyebrow}</p>
              <h1>{c.hero.title}</h1>
              <p className={styles.heroLede}>{c.hero.body}</p>
              <p className={styles.heroSecondary}>{c.hero.secondary}</p>
              <div className={styles.actions}>
                <Link className={styles.primary} href={consultation}>
                  {c.hero.primary}
                  <ArrowRight />
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
        <div className={styles.shell}>
          <Reveal>
            <Heading eyebrow={c.evidence.eyebrow} title={c.evidence.title} body={c.evidence.body} />
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
        <div className={styles.shell}>
          <Reveal>
            <div className={styles.headingRow}>
              <Heading
                eyebrow={c.understand.eyebrow}
                title={c.understand.title}
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
        <div className={styles.shell}>
          <Reveal className={styles.recordLayout}>
            <div>
              <Heading eyebrow={c.record.eyebrow} title={c.record.title} />
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
        <div className={styles.shell}>
          <Reveal>
            <Heading eyebrow={c.prepare.eyebrow} title={c.prepare.title} body={c.prepare.body} />
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
        <div className={styles.shell}>
          <Reveal>
            <div className={styles.headingRow}>
              <Heading eyebrow={c.teach.eyebrow} title={c.teach.title} />
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
        <div className={styles.shell}>
          <Reveal className={styles.betweenLayout}>
            <Heading eyebrow={c.between.eyebrow} title={c.between.title} body={c.between.body} />
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
        <div className={styles.shell}>
          <Reveal className={styles.parentLayout}>
            <div>
              <Heading eyebrow={c.parents.eyebrow} title={c.parents.title} body={c.parents.body} />
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
        <div className={styles.shell}>
          <Reveal>
            <Heading eyebrow={c.match.eyebrow} title={c.match.title} body={c.match.body} />
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
        <div className={styles.shell}>
          <Reveal>
            <div className={styles.verifyLayout}>
              <div>
                <Heading eyebrow={c.verify.eyebrow} title={c.verify.title} />
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
        <div className={styles.shell}>
          <Reveal>
            <Heading title={c.system.title} inverse />
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
        <div className={styles.shell}>
          <Reveal>
            <Heading eyebrow={c.logic.eyebrow} title={c.logic.title} body={c.logic.body} />
            <LearningLogic c={c.logic} />
          </Reveal>
        </div>
      </section>

      <section className={styles.curriculumSection}>
        <div className={styles.shell}>
          <Reveal>
            <Heading title={c.curriculum.title} />
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
        <div className={styles.shell}>
          <Reveal>
            <Heading title={c.overview.title} />
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
        <div className={styles.shell}>
          <Reveal className={styles.finalPanel}>
            <div className={styles.finalIcon}>
              <BrainCircuit />
              <i />
              <i />
              <i />
            </div>
            <div>
              <h2>{c.final.title}</h2>
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
