import { getTranslations } from "next-intl/server";
import { Star } from "lucide-react";

import type { RatingBreakdown as RatingBreakdownData } from "../../../../packages/domain/discussions/ratings";
import { formatRelativeTime } from "./format";
import styles from "./rating-dialog.module.css";

export async function RatingBreakdownPanel({
  breakdown,
  locale,
}: {
  breakdown: RatingBreakdownData;
  locale: string;
}) {
  const t = await getTranslations("discussions");
  if (breakdown.count === 0) return null;

  return (
    <div className={styles.breakdown}>
      <div className={styles.breakdownSummary}>
        <Star size={16} aria-hidden="true" />
        <span className={styles.breakdownAverage}>{breakdown.average?.toFixed(1) ?? "—"}</span>
        <span className={styles.breakdownCount}>
          {t("detail.ratingAverage", {
            average: breakdown.average?.toFixed(1) ?? "—",
            count: breakdown.count,
          })}
        </span>
      </div>
      <div className={styles.distribution}>
        {([5, 4, 3, 2, 1] as const).map((star) => {
          const starCount = breakdown.distribution[star] ?? 0;
          const percent = breakdown.count > 0 ? Math.round((starCount / breakdown.count) * 100) : 0;
          return (
            <div key={star} className={styles.distributionRow}>
              <span>{star} ★</span>
              <span className={styles.distributionTrack}>
                <span className={styles.distributionFill} style={{ width: `${percent}%` }} />
              </span>
              <span>{starCount}</span>
            </div>
          );
        })}
      </div>
      <ul className={styles.ratingEntries}>
        {breakdown.ratings.map((rating) => (
          <li key={rating.id} className={styles.ratingEntry}>
            <div className={styles.ratingEntryMeta}>
              <span>{rating.tutorDisplayName}</span>
              <span>{"★".repeat(rating.rating)}</span>
              <time dateTime={rating.createdAt.toISOString()}>
                {formatRelativeTime(rating.createdAt, locale)}
              </time>
            </div>
            {rating.publicFeedback ? <p>{rating.publicFeedback}</p> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
