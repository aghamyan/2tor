"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowRight, Check, ChevronDown, LockKeyhole } from "lucide-react";
import type { HowItWorksCopy } from "./how-it-works-content";
import styles from "./how-it-works.module.css";

export function Reveal({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8%" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={ref} className={`${styles.reveal} ${visible ? styles.revealed : ""} ${className}`}>
      {children}
    </div>
  );
}

export function KnowledgeMap({ c }: { c: HowItWorksCopy["understand"] }) {
  const [selected, setSelected] = useState("0-0");
  const [categoryIndex = 0, skillIndex = 0] = selected.split("-").map(Number);
  const active = c.categories[categoryIndex]?.skills[skillIndex] ?? [
    "Skill",
    "Evidence",
    "Observation",
    "Next step",
  ];
  return (
    <div className={styles.knowledgeMap}>
      <div className={styles.skillColumns}>
        {c.categories.map((category, ci) => (
          <section
            className={styles.skillColumn}
            data-tone={category.tone}
            key={category.title}
            aria-labelledby={`skill-${ci}`}
          >
            <div className={styles.skillColumnHead}>
              <span aria-hidden="true" />
              <h3 id={`skill-${ci}`}>{category.title}</h3>
            </div>
            <div className={styles.skillButtons}>
              {category.skills.map((skill, si) => {
                const id = `${ci}-${si}`;
                return (
                  <button
                    type="button"
                    aria-pressed={selected === id}
                    onClick={() => setSelected(id)}
                    key={skill[0]}
                  >
                    <span>{skill[0]}</span>
                    <ArrowRight aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
      <div className={styles.evidenceDrawer} aria-live="polite">
        <div>
          <span>01</span>
          <small>{c.details[0]}</small>
          <strong>{active[1]}</strong>
        </div>
        <div>
          <span>02</span>
          <small>{c.details[1]}</small>
          <strong>{active[2]}</strong>
        </div>
        <div>
          <span>03</span>
          <small>{c.details[2]}</small>
          <strong>{active[3]}</strong>
        </div>
      </div>
    </div>
  );
}

export function RecordTabs({ c }: { c: HowItWorksCopy["record"] }) {
  const [active, setActive] = useState(0);
  const panel = c.tabs[active] ?? { label: "Knowledge", title: "Learning record", stats: [] };
  const ids = c.tabs.map((_, index) => `record-tab-${index}`);
  return (
    <div className={styles.recordPreview}>
      <div className={styles.previewBar}>
        <span>
          <i />
          2tor learning record
        </span>
        <LockKeyhole aria-label={c.privacy} />
      </div>
      <div className={styles.tabList} role="tablist" aria-label="Learning record sections">
        {c.tabs.map((tab, index) => (
          <button
            id={ids[index]}
            aria-controls={`record-panel-${index}`}
            aria-selected={active === index}
            role="tab"
            tabIndex={active === index ? 0 : -1}
            key={tab.label}
            onClick={() => setActive(index)}
            onKeyDown={(event) => {
              if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
              const next =
                event.key === "ArrowRight"
                  ? (index + 1) % c.tabs.length
                  : (index - 1 + c.tabs.length) % c.tabs.length;
              setActive(next);
              const nextId = ids[next];
              if (nextId) document.getElementById(nextId)?.focus();
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div
        className={styles.tabPanel}
        id={`record-panel-${active}`}
        role="tabpanel"
        aria-labelledby={ids[active]}
        tabIndex={0}
      >
        <div className={styles.profileHeading}>
          <span>A</span>
          <div>
            <small>Aram · Mathematics</small>
            <h3>{panel.title}</h3>
          </div>
        </div>
        <div className={styles.statGrid}>
          {/*
           * The meter is rendered only for tiles that carry a percentage — see `RecordStat`. Its
           * width is inline because it is data, not styling: the shared `.statGrid b` rule can only
           * hold one number, and one number for every bar is what made them all identical.
           */}
          {panel.stats.map(([label, value, meter]) => (
            <div key={label}>
              <small>{label}</small>
              <strong>{value}</strong>
              {meter === undefined ? null : (
                <i>
                  <b style={{ width: `${meter}%` }} />
                </i>
              )}
            </div>
          ))}
        </div>
      </div>
      <p className={styles.privacyNote}>
        <LockKeyhole aria-hidden="true" />
        {c.privacy}
      </p>
    </div>
  );
}

export function LearningLogic({ c }: { c: HowItWorksCopy["logic"] }) {
  const [active, setActive] = useState(0);
  return (
    <div className={styles.logicExplorer}>
      <div className={styles.logicQuestions}>
        {c.items.map(([question], index) => (
          <button
            key={question}
            type="button"
            aria-expanded={active === index}
            aria-controls={`logic-${index}`}
            onClick={() => setActive(index)}
          >
            <span>0{index + 1}</span>
            {question}
            <ChevronDown aria-hidden="true" />
          </button>
        ))}
      </div>
      <div className={styles.logicAnswer} id={`logic-${active}`} aria-live="polite">
        <span>
          <Check aria-hidden="true" />
        </span>
        <p>{c.items[active]?.[1]}</p>
      </div>
    </div>
  );
}
