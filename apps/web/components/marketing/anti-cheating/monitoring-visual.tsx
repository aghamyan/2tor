"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  ClipboardCheck,
  PlayCircle,
  ShieldCheck,
  Smartphone,
  UserCheck,
  type LucideIcon,
} from "lucide-react";
import type { AntiCheatingCopy } from "./anti-cheating-content";
import styles from "./monitoring-visual.module.css";

const ease = [0.22, 1, 0.36, 1] as const;

const sequenceIcon: Record<string, LucideIcon> = {
  present: UserCheck,
  started: PlayCircle,
  focus: ShieldCheck,
  phone: Smartphone,
  logged: ClipboardCheck,
  report: ShieldCheck,
};

/** Card position on the ring around the workspace, in reading order. */
const layout = [
  { top: "6%", left: "-8%" },
  { top: "0%", right: "-10%" },
  { top: "34%", left: "-14%" },
  { top: "38%", right: "-16%" },
  { bottom: "10%", left: "-6%" },
  { bottom: "2%", right: "-8%" },
] as const;

export interface MonitoringVisualProps {
  copy: AntiCheatingCopy["visual"];
  size?: "large" | "compact";
}

/**
 * One-pass, scroll-triggered reveal (`whileInView` + `viewport once:true`) rather than a timer
 * loop — on the homepage this is what keeps the section compliant with WCAG 2.2.2 the same way
 * `compact-home.tsx`'s `useSubjectRotation` is (see that file's comment): content that settles
 * after one pass needs no separate pause control. On mount-in-view (the dedicated page's hero) it
 * simply plays once immediately.
 */
export function MonitoringVisual({ copy, size = "large" }: MonitoringVisualProps) {
  const reduceMotion = useReducedMotion();

  return (
    <div className={`${styles.stage} ${size === "compact" ? styles.stageCompact : ""}`}>
      <motion.div
        className={styles.laptop}
        aria-label={copy.ariaLabel}
        role="img"
        initial={{ opacity: 0, y: 26, rotateX: 6 }}
        whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
        viewport={{ once: true, amount: 0.5 }}
        transition={reduceMotion ? { duration: 0 } : { duration: 0.8, ease }}
      >
        <div className={styles.screen}>
          <div className={styles.screenChrome}>
            <span />
            <span />
            <span />
          </div>
          <div className={styles.screenBody}>
            <p className={styles.workspaceLabel}>{copy.workspaceLabel}</p>
            <p className={styles.questionProgress}>{copy.questionProgress}</p>
            <div className={styles.workLines} aria-hidden="true">
              <span />
              <span />
              <span className={styles.short} />
            </div>
          </div>
          {/* Always rendered — `useReducedMotion()` returns `null` during SSR and can already be
              `true` on the client's very first paint, so branching the element itself on it (as
              opposed to branching a style/transition value) produced a server/client hydration
              mismatch. The stylesheet's own `@media (prefers-reduced-motion: reduce)` rule hides
              this element consistently instead. */}
          <motion.span
            className={styles.scanLine}
            aria-hidden="true"
            initial={{ y: "0%", opacity: 0 }}
            whileInView={{ y: ["0%", "100%"], opacity: [0, 1, 0] }}
            viewport={{ once: true, amount: 0.5 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 1.6, delay: 0.5, ease }}
          />
        </div>
        <div className={styles.base} aria-hidden="true" />
      </motion.div>

      {copy.sequence.map((item, index) => {
        const Icon = sequenceIcon[item.key] ?? ShieldCheck;
        const position = layout[index % layout.length];
        return (
          <motion.div
            key={item.key}
            className={styles.signalCard}
            data-variant={item.key === "phone" ? "notice" : "default"}
            style={position}
            initial={{ opacity: 0, scale: 0.85, y: 10 }}
            whileInView={{ opacity: 1, scale: 1, y: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={
              reduceMotion ? { duration: 0 } : { duration: 0.5, delay: 0.9 + index * 0.42, ease }
            }
          >
            <Icon size={14} aria-hidden="true" />
            {item.label}
          </motion.div>
        );
      })}

      <motion.div
        className={styles.trustBadge}
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.5 }}
        transition={
          reduceMotion
            ? { duration: 0 }
            : { duration: 0.5, delay: 0.9 + copy.sequence.length * 0.42, ease }
        }
      >
        <span>{copy.statusTrusted}</span>
        <strong>{copy.statusIntegrity}</strong>
      </motion.div>
    </div>
  );
}
