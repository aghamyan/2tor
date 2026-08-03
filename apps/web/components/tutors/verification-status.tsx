import { getTranslations } from "next-intl/server";

import type {
  TutorSuspensionRecord,
  TutorVerificationRecord,
  TutorVerificationType,
} from "../../../../packages/domain/tutors/models";
import { StatusBadge, type BadgeTone } from "./status-badge";
import styles from "./tutors.module.css";
import { overallVerificationStatus } from "./verification-overall";

const TYPE_ORDER: TutorVerificationType[] = [
  "identity",
  "education",
  "background_check",
  "reference",
  "safeguarding_training",
];

type DisplayStatus = TutorVerificationRecord["status"] | "expired";

function displayStatus(record: TutorVerificationRecord, now: Date): DisplayStatus {
  if (record.status === "passed" && record.expiresAt && record.expiresAt < now) return "expired";
  return record.status;
}

function statusTone(status: DisplayStatus): BadgeTone {
  if (status === "passed") return "mint";
  if (status === "pending") return "amber";
  if (status === "failed" || status === "expired") return "coral";
  return "neutral"; // waived
}

const DOT_TONE_CLASS: Record<BadgeTone, string> = {
  mint: styles.badgeMint ?? "",
  amber: styles.badgeAmber ?? "",
  coral: styles.badgeCoral ?? "",
  indigo: styles.badgeIndigo ?? "",
  neutral: styles.badgeNeutral ?? "",
};

export async function VerificationStatus({
  verifications,
  suspensions,
}: {
  verifications: TutorVerificationRecord[];
  suspensions: TutorSuspensionRecord[];
}) {
  const t = await getTranslations("tutors.verification");
  const now = new Date();
  const activeSuspension = suspensions.find(
    (suspension) => !suspension.liftedAt && (!suspension.endAt || suspension.endAt > now),
  );

  const sorted = [...verifications].sort(
    (a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type),
  );

  const overall = overallVerificationStatus(verifications, suspensions, now);

  const overallTone: BadgeTone =
    overall === "verified"
      ? "mint"
      : overall === "inProgress"
        ? "amber"
        : overall === "actionRequired" || overall === "restricted"
          ? "coral"
          : "neutral";

  return (
    <div className={styles.card} id="verification-status" aria-labelledby="verification-status-heading">
      <div className={styles.cardHeader}>
        <div>
          <h2 className={styles.cardTitle} id="verification-status-heading">
            {t("title")}
          </h2>
          <p className={styles.cardDescription}>{t("description")}</p>
        </div>
        <div className={styles.cardBadges}>
          <StatusBadge tone={overallTone} label={t(`overall.${overall}`)} />
        </div>
      </div>

      {activeSuspension ? (
        <div className={styles.actionRequired}>
          <span>{activeSuspension.reason}</span>
        </div>
      ) : null}

      {sorted.length === 0 ? (
        <div className={styles.emptyState}>
          <h3>{t("emptyTitle")}</h3>
          <p>{t("emptyBody")}</p>
        </div>
      ) : (
        <div className={styles.timeline}>
          {sorted.map((record) => {
            const status = displayStatus(record, now);
            return (
              <div className={styles.timelineItem} key={record.id}>
                <span
                  className={`${styles.timelineDot} ${DOT_TONE_CLASS[statusTone(status)]}`}
                  aria-hidden="true"
                />
                <div className={styles.timelineBody}>
                  <strong>{t(`type.${record.type}`)}</strong>
                  <StatusBadge tone={statusTone(status)} label={t(`status.${status}`)} />
                  <span>
                    {record.verifiedAt
                      ? new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(record.verifiedAt)
                      : t("statusPending")}
                  </span>
                  {record.notes ? <p>{record.notes}</p> : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
