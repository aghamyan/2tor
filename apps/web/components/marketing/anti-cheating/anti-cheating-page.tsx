import { useTranslations } from "next-intl";
import { ArrowRight, Check, PlayCircle } from "lucide-react";
import type { Locale } from "@app/i18n/config";
import type { AntiCheatingCopy } from "./anti-cheating-content";
import { buildScriptedTimeline, REPORT_INTEGRITY_CATEGORIES, REPORT_INTEGRITY_SCORE } from "./demo-data";
import { MonitoringVisual } from "./monitoring-visual";
import { MonitoringCapabilityGrid } from "./monitoring-capability-grid";
import { LiveSessionDemo } from "./live-session-demo";
import { ParentReportPreview } from "./parent-report-preview";
import { PrivacySection } from "./privacy-section";
import { HomeworkSessionLauncher } from "./anti-cheating-interactive";
import { AntiCheatingCta } from "./anti-cheating-cta";
import styles from "./anti-cheating-page.module.css";

function SectionHeading({
  eyebrow,
  title,
  body,
  align = "left",
  id,
}: {
  eyebrow: string;
  title: string;
  body?: string;
  align?: "left" | "center";
  id?: string;
}) {
  return (
    <div className={`${styles.sectionHeading} ${align === "center" ? styles.sectionHeadingCenter : ""}`}>
      <p className={styles.eyebrow}>{eyebrow}</p>
      <h2 id={id}>{title}</h2>
      {body && <p className={styles.sectionLede}>{body}</p>}
    </div>
  );
}

export function AntiCheatingPage({ locale }: { locale: Locale }) {
  const t = useTranslations("antiCheating");
  const c = t.raw("content") as AntiCheatingCopy;
  const reportEvents = buildScriptedTimeline(c.liveDemo.events);

  return (
    <div className={styles.page}>
      <section className={styles.hero} aria-labelledby="anti-cheating-hero-title">
        <div className={styles.shell}>
          <div className={styles.heroGrid}>
            <div className={styles.heroCopy}>
              <p className={styles.eyebrow}>{c.hero.eyebrow}</p>
              <h1 id="anti-cheating-hero-title">{c.hero.title}</h1>
              <p className={styles.heroLede}>{c.hero.body}</p>
              <p className={styles.heroNote}>{c.hero.note}</p>
              <div className={styles.heroActions}>
                <a className={styles.primaryCta} href="#start-session">
                  {c.hero.primary}
                  <ArrowRight size={18} aria-hidden="true" />
                </a>
                <a className={styles.secondaryCta} href="#live-demo">
                  <PlayCircle size={18} aria-hidden="true" />
                  {c.hero.secondary}
                </a>
              </div>
              <ul className={styles.trustRow}>
                {c.hero.trust.map((item) => (
                  <li key={item}>
                    <Check size={15} aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <MonitoringVisual copy={c.visual} />
          </div>
        </div>
      </section>

      <section id="how-it-works" className={styles.watchSection} aria-labelledby="watch-title">
        <div className={styles.shell}>
          <SectionHeading id="watch-title" eyebrow={c.watch.eyebrow} title={c.watch.title} body={c.watch.body} align="center" />
          <div className={styles.stepGrid}>
            {c.watch.steps.map((step) => (
              <div className={styles.stepCard} key={step.number}>
                <span className={styles.stepNumber}>{step.number}</span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.capabilitiesSection} aria-labelledby="capabilities-title">
        <div className={styles.shell}>
          <SectionHeading
            id="capabilities-title"
            eyebrow={c.capabilities.eyebrow}
            title={c.capabilities.title}
            body={c.capabilities.body}
          />
          <MonitoringCapabilityGrid items={c.capabilities.items} statusLabels={c.capabilities.statusLabels} />
          <p className={styles.boundaryNote}>{c.capabilities.boundaryNote}</p>
        </div>
      </section>

      <section id="live-demo" className={styles.liveDemoSection} aria-labelledby="live-demo-title">
        <div className={styles.shell}>
          <SectionHeading id="live-demo-title" eyebrow={c.liveDemo.eyebrow} title={c.liveDemo.title} body={c.liveDemo.body} align="center" />
          <LiveSessionDemo copy={c.liveDemo} severityLabels={c.severity} integrityCopy={c.integrityScore} />
        </div>
      </section>

      <section id="parent-report" className={styles.reportSection} aria-labelledby="report-title">
        <div className={styles.shell}>
          <SectionHeading id="report-title" eyebrow={c.report.eyebrow} title={c.report.title} align="center" />
          <ParentReportPreview
            copy={c.report}
            severityLabels={c.severity}
            integrityCopy={c.integrityScore}
            score={REPORT_INTEGRITY_SCORE}
            ratingLabel={c.report.integrityRating}
            categories={REPORT_INTEGRITY_CATEGORIES.map((category) => ({ ...category }))}
            events={reportEvents}
          />
        </div>
      </section>

      <PrivacySection copy={c.privacy} locale={locale} />

      <section id="start-session" className={styles.startSection} aria-labelledby="start-session-title">
        <div className={styles.shell}>
          <SectionHeading id="start-session-title" eyebrow={c.setup.eyebrow} title={c.setup.title} align="center" />
          <HomeworkSessionLauncher
            setupCopy={c.setup}
            studentModeCopy={c.studentMode}
            privacyCopy={c.privacy}
            severityLabels={c.severity}
            launchLabel={c.hero.primary}
            launchHint={c.setup.launchHint}
          />
        </div>
      </section>

      <AntiCheatingCta
        title={c.finalCta.title}
        body={c.finalCta.body}
        primary={{ label: c.finalCta.primary, href: "#start-session" }}
        secondary={{ label: c.finalCta.secondary, href: "#how-it-works" }}
      />
    </div>
  );
}
