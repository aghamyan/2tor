"use client";

import { PlayCircle } from "lucide-react";
import { useReducedMotion } from "framer-motion";
import { useState } from "react";
import type { AntiCheatingCopy } from "./anti-cheating-content";
import { HomeworkSessionSetup, type SessionConfig } from "./homework-session-setup";
import { StudentHomeworkMode } from "./student-homework-mode";
import styles from "./anti-cheating-page.module.css";

type Phase = "idle" | "setup" | "handoff" | "active";

export interface HomeworkSessionLauncherProps {
  setupCopy: AntiCheatingCopy["setup"];
  studentModeCopy: AntiCheatingCopy["studentMode"];
  privacyCopy: AntiCheatingCopy["privacy"];
  severityLabels: AntiCheatingCopy["severity"];
  launchLabel: string;
  launchHint: string;
}

export function HomeworkSessionLauncher({
  setupCopy,
  studentModeCopy,
  privacyCopy,
  severityLabels,
  launchLabel,
  launchHint,
}: HomeworkSessionLauncherProps) {
  const reduceMotion = useReducedMotion();
  const [phase, setPhase] = useState<Phase>("idle");
  const [config, setConfig] = useState<SessionConfig | null>(null);

  function finishDemo() {
    setPhase("idle");
    setConfig(null);
    document
      .getElementById("parent-report")
      ?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  }

  if (phase === "active" && config) {
    return (
      <StudentHomeworkMode
        copy={studentModeCopy}
        privacyCopy={privacyCopy}
        severityLabels={severityLabels}
        config={config}
        onExit={finishDemo}
      />
    );
  }

  if (phase === "handoff" && config) {
    return (
      <div className={styles.setupCard}>
        <div className={styles.handoffScreen}>
          <h3>{setupCopy.handoff.title.replace("{name}", config.childName)}</h3>
          <p>{setupCopy.handoff.body.replace("{name}", config.childName)}</p>
          <div className={styles.formActions}>
            <button type="button" className={styles.formBack} onClick={() => setPhase("idle")}>
              {setupCopy.handoff.cancel}
            </button>
            <button type="button" className={styles.formSubmit} onClick={() => setPhase("active")}>
              <PlayCircle size={18} aria-hidden="true" />
              {setupCopy.handoff.begin}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "setup") {
    return (
      <HomeworkSessionSetup
        copy={setupCopy}
        onCancel={() => setPhase("idle")}
        onComplete={(nextConfig) => {
          setConfig(nextConfig);
          setPhase("handoff");
        }}
      />
    );
  }

  return (
    <div className={styles.launcherCard}>
      <button type="button" className={styles.launcherButton} onClick={() => setPhase("setup")}>
        <PlayCircle size={20} aria-hidden="true" />
        {launchLabel}
      </button>
      <p>{launchHint}</p>
    </div>
  );
}
