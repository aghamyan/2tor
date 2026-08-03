import styles from "./tutors.module.css";

export type BadgeTone = "mint" | "amber" | "coral" | "indigo" | "neutral";

const toneClass: Record<BadgeTone, string> = {
  mint: styles.badgeMint ?? "",
  amber: styles.badgeAmber ?? "",
  coral: styles.badgeCoral ?? "",
  indigo: styles.badgeIndigo ?? "",
  neutral: styles.badgeNeutral ?? "",
};

const toneGlyph: Record<BadgeTone, string> = {
  mint: "✓",
  amber: "●",
  coral: "!",
  indigo: "◔",
  neutral: "–",
};

/** Status is never carried by color alone — every badge pairs a tone with a glyph and label text. */
export function StatusBadge({ tone, label }: { tone: BadgeTone; label: string }) {
  return (
    <span className={`${styles.badge} ${toneClass[tone]}`}>
      <span aria-hidden="true">{toneGlyph[tone]}</span>
      {label}
    </span>
  );
}
