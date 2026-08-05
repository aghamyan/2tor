"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import styles from "../assessments.module.css";
import type { SignalBus } from "./signal-bus";

export interface IntegrityPolicyBannerProps {
  violationCount: number;
  policy: { violationLimit: number | null; action: "log_only" | "warn" | "auto_submit" };
  bus: SignalBus | null;
}

/**
 * Distinct from `SuspicionBanner`: that one reacts to the always-on, non-configurable suspicion
 * score. This one only ever appears when a tutor explicitly opted this assessment into the
 * `"warn"` integrity policy (see `AssessmentIntegrityPolicy` in models.ts) and only once the
 * student's own violation count reaches the tutor-configured limit. Showing it is itself logged
 * as `warning_shown`, same as the suspicion banner, so the tutor's timeline reflects what the
 * student actually saw.
 */
export function IntegrityPolicyBanner({ violationCount, policy, bus }: IntegrityPolicyBannerProps) {
  const t = useTranslations("assessments");
  const warned = useRef(false);

  const active =
    policy.action === "warn" && policy.violationLimit !== null && violationCount >= policy.violationLimit;

  useEffect(() => {
    if (!active || warned.current) return;
    warned.current = true;
    bus?.emit("warning_shown", { reason: "integrity_policy", violationCount });
    // Only ever emit the first time this crosses the threshold in this session.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- violationCount is read via closure intentionally.
  }, [active, bus]);

  if (!active) return null;

  return (
    <div className={styles.suspicionBanner} role="alert">
      <p>{t("proctoring.warning.integrityPolicy")}</p>
    </div>
  );
}
