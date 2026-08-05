"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import type { SuspicionSummary } from "../../../../../packages/domain/assessments/models";
import styles from "../assessments.module.css";
import type { SignalBus } from "./signal-bus";

export interface SuspicionBannerProps {
  suspicion: SuspicionSummary;
  bus: SignalBus | null;
}

/**
 * Non-blocking, informational only — crossing the threshold never fails or pauses the student
 * (spec §3: "Never auto-fail"). Showing the banner is itself logged as `warning_shown` so the
 * tutor's review timeline reflects what the student actually saw.
 */
export function SuspicionBanner({ suspicion, bus }: SuspicionBannerProps) {
  const t = useTranslations("assessments");
  const warnedForSeverity = useRef<"medium" | "high" | null>(null);

  useEffect(() => {
    if (suspicion.severity === "low") {
      warnedForSeverity.current = null;
      return;
    }
    if (warnedForSeverity.current === suspicion.severity) return;
    warnedForSeverity.current = suspicion.severity;
    bus?.emit("warning_shown", { severity: suspicion.severity });
  }, [suspicion.severity, bus]);

  if (suspicion.severity === "low") return null;

  return (
    <div className={styles.suspicionBanner} role="alert">
      <p>{t("proctoring.warning.returnToAssessment")}</p>
    </div>
  );
}
