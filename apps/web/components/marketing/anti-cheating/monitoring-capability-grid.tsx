"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Camera, CircleCheck, Clock3 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  Bot,
  ClipboardCopy,
  Globe,
  ListChecks,
  Smartphone,
  UserCheck,
  UserX,
  Users,
  AppWindow,
  SquareArrowOutUpRight,
} from "lucide-react";
import styles from "./anti-cheating-page.module.css";

const ease = [0.22, 1, 0.36, 1] as const;

const capabilityIcon: Record<string, LucideIcon> = {
  "phone-detected": Smartphone,
  "tab-switch": SquareArrowOutUpRight,
  "window-blur": AppWindow,
  "external-resource": Globe,
  "ai-resource": Bot,
  "copy-paste": ClipboardCopy,
  "student-absent": UserCheck,
  "multiple-persons": Users,
  "session-timeline": ListChecks,
};

/** Keyed by `MonitoringSignalStatus`, but widened to `string` since these values come straight
 *  from the JSON copy tree — see the identical rationale on `MonitoringCapabilityItem.status`. */
const statusIcon: Record<string, LucideIcon> = {
  real: CircleCheck,
  camera: Camera,
  future: Clock3,
};

export interface MonitoringCapabilityItem {
  key: string;
  title: string;
  body: string;
  /** `MonitoringSignalStatus` at runtime; widened to `string` because it's read from translated
   *  JSON copy, whose literal-vs-`string` inference for values (unlike object keys) isn't a
   *  contract this module wants to depend on. */
  status: string;
}

export interface MonitoringCapabilityGridProps {
  items: MonitoringCapabilityItem[];
  statusLabels: Record<string, string>;
}

export function MonitoringCapabilityGrid({ items, statusLabels }: MonitoringCapabilityGridProps) {
  const reduceMotion = useReducedMotion();
  return (
    <div className={styles.capabilityGrid}>
      {items.map((item, index) => {
        const Icon = capabilityIcon[item.key] ?? UserX;
        const StatusIcon = statusIcon[item.status] ?? Clock3;
        return (
          <motion.article
            key={item.key}
            className={styles.capabilityCard}
            data-status={item.status}
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={
              reduceMotion ? { duration: 0 } : { duration: 0.5, delay: (index % 3) * 0.08, ease }
            }
          >
            <span className={styles.capabilityIcon} aria-hidden="true">
              <Icon size={20} />
            </span>
            <h3>{item.title}</h3>
            <p>{item.body}</p>
            <span className={styles.capabilityStatus} data-status={item.status}>
              <StatusIcon size={13} aria-hidden="true" />
              {statusLabels[item.status]}
            </span>
          </motion.article>
        );
      })}
    </div>
  );
}
