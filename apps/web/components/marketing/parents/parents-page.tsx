import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Clock3,
  Eye,
  FileCheck2,
  GraduationCap,
  HeartHandshake,
  LockKeyhole,
  ReceiptText,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  Target,
  UserRoundCheck,
  Users,
} from "lucide-react";
import type { Locale } from "@app/i18n/config";
import type { ParentsCopy } from "./parents-content";
import { ParentConsultationFlow, ParentDashboardTabs } from "./parents-interactive";
import { ParentDashboardPreview } from "./parent-dashboard-preview";
import styles from "./parents-page.module.css";

function localHref(locale: Locale, path: string) {
  return `/${locale}${path}`;
}

function SectionHeading({
  eyebrow,
  title,
  body,
  align = "left",
}: {
  eyebrow: string;
  title: string;
  body?: string;
  align?: "left" | "center";
}) {
  return (
    <div
      className={`${styles.sectionHeading} ${align === "center" ? styles.sectionHeadingCenter : ""}`}
    >
      <p className={styles.eyebrow}>{eyebrow}</p>
      <h2>{title}</h2>
      {body && <p className={styles.sectionLede}>{body}</p>}
    </div>
  );
}

function CheckList({ items, warning = false }: { items: readonly string[]; warning?: boolean }) {
  return (
    <ul className={styles.checkList}>
      {items.map((item) => (
        <li key={item}>
          {warning ? <CircleAlert aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function ParentsPage({ locale }: { locale: Locale }) {
  const t = useTranslations("parents");
  const c = t.raw("content") as ParentsCopy;
  const safetyHref = localHref(locale, "/safety");

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.shell}>
          <div className={styles.heroGrid}>
            <div className={styles.heroCopy}>
              <p className={styles.eyebrow}>{c.hero.eyebrow}</p>
              <h1>{c.hero.title}</h1>
              <p className={styles.heroLede}>{c.hero.body}</p>
              <p className={styles.heroReassurance}>
                <HeartHandshake aria-hidden="true" />
                {c.hero.reassurance}
              </p>
              <div className={styles.heroActions}>
                <a className={styles.primaryCta} href="#consultation-flow">
                  {c.hero.primary}
                  <ArrowRight aria-hidden="true" />
                </a>
                <a className={styles.secondaryCta} href="#parent-workspace">
                  {c.hero.secondary}
                  <Eye aria-hidden="true" />
                </a>
              </div>
              <p className={styles.heroNote}>{c.hero.note}</p>
              <ul className={styles.trustRow}>
                {c.hero.trust.map((item) => (
                  <li key={item}>
                    <Check aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <ParentDashboardPreview c={c.dashboard} id="parent-workspace" />
          </div>
        </div>
      </section>

      <section className={styles.beforeAfterSection}>
        <div className={styles.shell}>
          <SectionHeading
            eyebrow={c.beforeAfter.eyebrow}
            title={c.beforeAfter.title}
            body={c.beforeAfter.body}
          />
          <div className={styles.beforeAfterGrid}>
            <article className={styles.withoutCard}>
              <h3>{c.beforeAfter.withoutTitle}</h3>
              <CheckList items={c.beforeAfter.without} warning />
            </article>
            <article className={styles.withCard}>
              <h3>{c.beforeAfter.withTitle}</h3>
              <CheckList items={c.beforeAfter.with} />
            </article>
          </div>
        </div>
      </section>

      <section className={styles.visibilitySection}>
        <div className={styles.shell}>
          <SectionHeading
            eyebrow={c.visibility.eyebrow}
            title={c.visibility.title}
            body={c.visibility.body}
          />
          <ParentDashboardTabs tabs={c.visibility.tabs} ariaLabel={c.visibility.ariaLabel} />
        </div>
      </section>

      <section className={styles.lessonSection}>
        <div className={styles.shell}>
          <div className={styles.lessonGrid}>
            <div className={styles.lessonIntro}>
              <SectionHeading
                eyebrow={c.lesson.eyebrow}
                title={c.lesson.title}
                body={c.lesson.body}
              />
              <div className={styles.lessonMetaNotes}>
                <span>
                  <Clock3 /> {c.lesson.publishedAfter}
                </span>
                <span>
                  <Eye /> {c.lesson.linkedParent}
                </span>
              </div>
            </div>
            <article className={styles.lessonCard}>
              <header className={styles.lessonCardHeader}>
                <div>
                  <p>{c.lesson.topicLabel}</p>
                  <h3>{c.lesson.topic}</h3>
                  <span>{c.lesson.tutor}</span>
                </div>
                <span className={styles.attendancePill}>
                  <CircleCheck />
                  {c.lesson.attendance}
                </span>
              </header>
              <div className={styles.lessonSignalRow}>
                <span>
                  <Sparkles />
                  {c.lesson.engagement}
                </span>
                <span>
                  <Target />
                  {c.lesson.skills.length} {c.lesson.skillsPractised}
                </span>
              </div>
              <div className={styles.lessonDetailGrid}>
                <div className={styles.lessonPositive}>
                  <p>{c.lesson.strengthLabel}</p>
                  <strong>{c.lesson.strength}</strong>
                </div>
                <div className={styles.lessonAttention}>
                  <p>{c.lesson.challengeLabel}</p>
                  <strong>{c.lesson.challenge}</strong>
                </div>
                <div>
                  <p>{c.lesson.homeworkLabel}</p>
                  <strong>{c.lesson.homework}</strong>
                </div>
                <div>
                  <p>{c.lesson.nextLabel}</p>
                  <strong>{c.lesson.next}</strong>
                </div>
              </div>
              <div className={styles.planAction}>
                <FileCheck2 />
                <span>{c.lesson.planAction}</span>
                <ChevronRight />
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className={styles.planSection}>
        <div className={styles.shell}>
          <SectionHeading
            eyebrow={c.plan.eyebrow}
            title={c.plan.title}
            body={c.plan.body}
            align="center"
          />
          <ol className={styles.planSteps}>
            {c.plan.steps.map((step, index) => (
              <li key={step}>
                <span>{index + 1}</span>
                <strong>{step}</strong>
              </li>
            ))}
          </ol>
          <div className={styles.curriculumPath}>
            <div className={styles.curriculumPathHead}>
              <span>{c.plan.pathLabel}</span>
              <Link href={localHref(locale, "/mathematics")}>
                {c.plan.cta}
                <ArrowRight />
              </Link>
            </div>
            <ol>
              {c.plan.path.map((item) => (
                <li className={styles[`path_${item.state}`]} key={item.label}>
                  <span>
                    {item.state === "complete" ? (
                      <Check />
                    ) : item.state === "current" ? (
                      <Target />
                    ) : (
                      <ChevronRight />
                    )}
                  </span>
                  <strong>{item.label}</strong>
                  <small>
                    {item.state === "complete"
                      ? c.plan.complete
                      : item.state === "current"
                        ? c.plan.current
                        : c.plan.upcoming}
                  </small>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className={styles.levelSection}>
        <div className={styles.shell}>
          <div className={styles.levelTop}>
            <SectionHeading eyebrow={c.level.eyebrow} title={c.level.title} body={c.level.body} />
            <div className={styles.evidenceCloud}>
              {c.level.sources.map((source) => (
                <span key={source}>
                  <Check />
                  {source}
                </span>
              ))}
            </div>
          </div>
          <div className={styles.pathwayGrid}>
            {c.level.pathways.map((pathway, index) => (
              <article key={pathway.title}>
                <span>{index + 1}</span>
                <h3>{pathway.title}</h3>
                <p>{pathway.body}</p>
              </article>
            ))}
          </div>
          <p className={styles.changeNote}>
            <RefreshCcw />
            {c.level.note}
          </p>
        </div>
      </section>

      <section className={styles.tutorSection}>
        <div className={styles.shell}>
          <div className={styles.tutorGrid}>
            <div>
              <SectionHeading eyebrow={c.tutor.eyebrow} title={c.tutor.title} body={c.tutor.body} />
              <div className={styles.tutorChecks}>
                {c.tutor.checks.map((check) => (
                  <span key={check}>
                    <ShieldCheck />
                    {check}
                  </span>
                ))}
              </div>
              <Link className={styles.textLink} href={safetyHref}>
                {c.tutor.cta}
                <ArrowRight />
              </Link>
            </div>
            <article className={styles.tutorProfile}>
              <p className={styles.profileLabel}>{c.tutor.profileLabel}</p>
              <div className={styles.profileTop}>
                <span className={styles.profileAvatar}>MS</span>
                <div>
                  <h3>{c.tutor.name}</h3>
                  <p>{c.tutor.role}</p>
                </div>
                <span className={styles.verifiedBadge}>
                  <ShieldCheck />
                  {c.tutor.reviewedLabel}
                </span>
              </div>
              <dl className={styles.profileFacts}>
                <div>
                  <dt>{c.tutor.gradesLabel}</dt>
                  <dd>{c.tutor.grades}</dd>
                </div>
                <div>
                  <dt>{c.tutor.languagesLabel}</dt>
                  <dd>{c.tutor.languages}</dd>
                </div>
                <div>
                  <dt>{c.tutor.experienceLabel}</dt>
                  <dd>{c.tutor.experience}</dd>
                </div>
              </dl>
              <div className={styles.approachBox}>
                <p>{c.tutor.approachLabel}</p>
                <strong>{c.tutor.approach}</strong>
              </div>
              <p className={styles.profileFoot}>
                <CheckCircle2 />
                {c.tutor.verified}
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className={styles.communicationSection}>
        <div className={styles.shell}>
          <div className={styles.communicationGrid}>
            <div>
              <SectionHeading
                eyebrow={c.communication.eyebrow}
                title={c.communication.title}
                body={c.communication.body}
              />
              <div className={styles.messageTopics}>
                {c.communication.appropriate.map((topic) => (
                  <span key={topic}>{topic}</span>
                ))}
              </div>
            </div>
            <div className={styles.messagePreview}>
              <div className={styles.messageTutor}>
                <p>{c.communication.tutorLabel}</p>
                <blockquote>{c.communication.tutorMessage}</blockquote>
              </div>
              <div className={styles.messageParent}>
                <p>{c.communication.parentLabel}</p>
                <blockquote>{c.communication.parentMessage}</blockquote>
              </div>
              <small>
                <ShieldCheck />
                {c.communication.note}
              </small>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.controlSection}>
        <div className={styles.shell}>
          <SectionHeading
            eyebrow={c.control.eyebrow}
            title={c.control.title}
            body={c.control.body}
            align="center"
          />
          <div className={styles.roleSplit}>
            <article className={styles.tutorManaged}>
              <span className={styles.roleIcon}>
                <GraduationCap />
              </span>
              <h3>{c.control.tutorTitle}</h3>
              <CheckList items={c.control.tutorItems} />
            </article>
            <div className={styles.roleDivider}>
              <span>{c.control.sharedPlan}</span>
            </div>
            <article className={styles.parentControlled}>
              <span className={styles.roleIcon}>
                <UserRoundCheck />
              </span>
              <h3>{c.control.parentTitle}</h3>
              <CheckList items={c.control.parentItems} />
            </article>
          </div>
        </div>
      </section>

      <section className={styles.formatsSection}>
        <div className={styles.shell}>
          <SectionHeading
            eyebrow={c.formats.eyebrow}
            title={c.formats.title}
            body={c.formats.body}
          />
          <div className={styles.formatGrid}>
            <article className={styles.individualCard}>
              <span className={styles.formatIcon}>
                <UserRoundCheck />
              </span>
              <h3>{c.formats.individual.title}</h3>
              <p>{c.formats.individual.intro}</p>
              <CheckList items={c.formats.individual.items} />
              <Link href={localHref(locale, "/how-it-works")}>
                {c.formats.individual.cta}
                <ArrowRight />
              </Link>
            </article>
            <article className={styles.groupCard}>
              <span className={styles.formatIcon}>
                <Users />
              </span>
              <h3>{c.formats.group.title}</h3>
              <p>{c.formats.group.intro}</p>
              <CheckList items={c.formats.group.items} />
              <small>{c.formats.group.note}</small>
              <Link href={localHref(locale, "/group-lessons")}>
                {c.formats.group.cta}
                <ArrowRight />
              </Link>
            </article>
          </div>
        </div>
      </section>

      <section className={styles.safetySection}>
        <div className={styles.shell}>
          <div className={styles.safetyPanel}>
            <div className={styles.safetyCopy}>
              <span className={styles.safetyIcon}>
                <LockKeyhole />
              </span>
              <SectionHeading
                eyebrow={c.safety.eyebrow}
                title={c.safety.title}
                body={c.safety.body}
              />
              <Link href={safetyHref}>
                {c.safety.cta}
                <ArrowRight />
              </Link>
            </div>
            <div className={styles.safetyList}>
              {c.safety.items.map((item) => (
                <span key={item}>
                  <ShieldCheck />
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className={styles.startSection}>
        <div className={styles.shell}>
          <SectionHeading
            eyebrow={c.start.eyebrow}
            title={c.start.title}
            body={c.start.body}
            align="center"
          />
          <ol className={styles.startTimeline}>
            {c.start.steps.map((item, index) => (
              <li key={item.title}>
                <span>{index + 1}</span>
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className={styles.consultationSection} id="consultation-flow">
        <div className={styles.shell}>
          <div className={styles.consultationGrid}>
            <div className={styles.consultationCopy}>
              <p className={styles.eyebrow}>{c.form.eyebrow}</p>
              <h2>{c.form.title}</h2>
              <p>{c.form.body}</p>
              <div className={styles.consultationAssurances}>
                <span>
                  <Clock3 />
                  {c.form.aboutTime}
                </span>
                <span>
                  <LockKeyhole />
                  {c.form.onlyDetails}
                </span>
                <span>
                  <ReceiptText />
                  {c.form.note}
                </span>
              </div>
            </div>
            <ParentConsultationFlow copy={c.form} locale={locale} />
          </div>
        </div>
      </section>

      <section className={styles.faqSection}>
        <div className={styles.shell}>
          <SectionHeading eyebrow={c.faq.eyebrow} title={c.faq.title} />
          <div className={styles.faqList}>
            {c.faq.items.map(([question, answer]) => (
              <details key={question}>
                <summary>
                  <span>{question}</span>
                  <span className={styles.faqPlus} aria-hidden="true">
                    +
                  </span>
                </summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.finalSection}>
        <div className={styles.shell}>
          <div className={styles.finalPanel}>
            <div>
              <span className={styles.finalIcon}>
                <Eye />
              </span>
              <h2>{c.final.title}</h2>
              <p>{c.final.body}</p>
              <small>{c.final.note}</small>
            </div>
            <div className={styles.finalActions}>
              <a href="#consultation-flow">
                {c.final.primary}
                <ArrowRight />
              </a>
              <Link href={localHref(locale, "/mathematics")}>
                {c.final.secondary}
                <ChevronRight />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <a className={styles.mobileStickyCta} href="#consultation-flow">
        {c.hero.primary}
        <ArrowRight />
      </a>
    </div>
  );
}
