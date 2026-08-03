import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, BookOpen, Check, ChevronRight, Clock3, Search, Sparkles } from "lucide-react";

import type { LearningStatus } from "./types";
import styles from "./workspace.module.css";

export function WorkspacePage({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`${styles.page} ${className}`}>{children}</div>;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className={styles.pageHeader}>
      <div>
        {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action ? <div className={styles.pageAction}>{action}</div> : null}
    </header>
  );
}

export function SectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className={styles.sectionHeader}>
      <div>
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function PrimaryLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className={styles.primaryButton}>
      {children}
      <ArrowRight aria-hidden="true" size={16} />
    </Link>
  );
}

export function SecondaryLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className={styles.secondaryButton}>
      {children}
    </Link>
  );
}

const statusLabel: Record<LearningStatus, string> = {
  pending: "To do",
  "in-progress": "In progress",
  submitted: "Submitted",
  reviewed: "Reviewed",
  completed: "Completed",
  overdue: "Overdue",
  developing: "Developing",
  mastered: "Mastered",
  practice: "Needs practice",
};

export function StatusBadge({ status }: { status: LearningStatus }) {
  return (
    <span className={styles.status} data-status={status}>
      {status === "completed" || status === "mastered" || status === "reviewed" ? (
        <Check size={12} aria-hidden="true" />
      ) : null}
      {statusLabel[status]}
    </span>
  );
}

export function ProgressBar({ value, label }: { value: number; label?: string }) {
  return (
    <div className={styles.progressWrap}>
      <div className={styles.progressMeta}>
        {label ? <span>{label}</span> : <span>Progress</span>}
        <strong>{value}%</strong>
      </div>
      <div
        className={styles.progressTrack}
        role="progressbar"
        aria-label={label ?? "Progress"}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
      >
        <span style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

export function ProgressRing({
  value,
  label,
  size = "regular",
}: {
  value: number;
  label: string;
  size?: "regular" | "small";
}) {
  return (
    <div
      className={styles.ring}
      data-size={size}
      style={{ "--ring-value": `${value * 3.6}deg` } as React.CSSProperties}
      role="img"
      aria-label={`${label}: ${value}%`}
    >
      <div>
        <strong>{value}%</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}

export function SearchField({ placeholder }: { placeholder: string }) {
  return (
    <label className={styles.searchField}>
      <Search aria-hidden="true" size={18} />
      <span className={styles.srOnly}>Search</span>
      <input type="search" placeholder={placeholder} />
      <kbd>⌘ K</kbd>
    </label>
  );
}

export function EmptyState({
  title,
  description,
  primary,
  secondary,
}: {
  title: string;
  description: string;
  primary: ReactNode;
  secondary?: ReactNode;
}) {
  return (
    <section className={styles.emptyState} role="status">
      <div className={styles.emptyIcon}>
        <BookOpen aria-hidden="true" size={24} />
      </div>
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
        <div className={styles.inlineActions}>
          {primary}
          {secondary}
        </div>
      </div>
    </section>
  );
}

export function MetricCard({
  label,
  value,
  detail,
  tone = "default",
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "default" | "positive" | "attention";
}) {
  return (
    <article className={styles.metricCard} data-tone={tone}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

export function CardLink({
  href,
  eyebrow,
  title,
  detail,
  meta,
}: {
  href: string;
  eyebrow: string;
  title: string;
  detail: string;
  meta?: string;
}) {
  return (
    <Link className={styles.cardLink} href={href}>
      <span>{eyebrow}</span>
      <h3>{title}</h3>
      <p>{detail}</p>
      <footer>
        {meta ? (
          <small>
            <Clock3 size={13} aria-hidden="true" />
            {meta}
          </small>
        ) : (
          <span />
        )}
        <ChevronRight size={17} aria-hidden="true" />
      </footer>
    </Link>
  );
}

export function LearningTrail({ active = 2 }: { active?: number }) {
  const labels = ["Learn", "Practice", "Apply", "Reflect"];
  return (
    <ol className={styles.learningTrail} aria-label="Current learning cycle">
      {labels.map((label, index) => (
        <li key={label} data-state={index < active ? "done" : index === active ? "active" : "next"}>
          <span>{index < active ? <Check size={13} aria-hidden="true" /> : index + 1}</span>
          <small>{label}</small>
        </li>
      ))}
    </ol>
  );
}

export function InsightNote({ children }: { children: ReactNode }) {
  return (
    <div className={styles.insightNote}>
      <Sparkles size={16} aria-hidden="true" />
      {children}
    </div>
  );
}

export { styles as workspaceStyles };
