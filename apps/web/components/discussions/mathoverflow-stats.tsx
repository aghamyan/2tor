import { CheckCircle2, MessageSquareText, ScanSearch } from "lucide-react";
import { getTranslations } from "next-intl/server";

import styles from "./discussion-shell.module.css";

export interface MathOverflowStatsData {
  visible: number;
  needsAttention: number;
  active: number;
  tutorReviewed: number;
}

export async function MathOverflowStats({
  stats,
  emphasizeAttention,
}: {
  stats: MathOverflowStatsData;
  emphasizeAttention: boolean;
}) {
  const t = await getTranslations("discussions.shell.stats");
  const entries = [
    { key: "visible", value: stats.visible, icon: ScanSearch, tone: "neutral" },
    {
      key: "needsAttention",
      value: stats.needsAttention,
      icon: MessageSquareText,
      tone: emphasizeAttention ? "attention" : "neutral",
    },
    { key: "active", value: stats.active, icon: MessageSquareText, tone: "primary" },
    { key: "tutorReviewed", value: stats.tutorReviewed, icon: CheckCircle2, tone: "verified" },
  ] as const;

  return (
    <dl className={styles.stats} aria-label={t("label")}>
      {entries.map(({ key, value, icon: Icon, tone }) => (
        <div key={key} className={styles.stat} data-tone={tone}>
          <dt>
            <Icon size={15} aria-hidden="true" />
            {t(key)}
          </dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
