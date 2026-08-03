import { getTranslations } from "next-intl/server";

import type { TutorAvailabilityRule, TutorProfileRecord } from "../../../../packages/domain/tutors/models";
import styles from "./tutors.module.css";
import { WeeklyAvailabilityEditor } from "./availability-editor";

/** `replaceTutorAvailability()` requires an existing profile (it reads the profile's time zone to
 * validate against). Locked, not hidden — same reasoning as `CapabilitiesEditorOrLocked`. */
export async function AvailabilityEditorOrLocked({
  profile,
  availability,
}: {
  profile: TutorProfileRecord | null;
  availability: TutorAvailabilityRule[];
}) {
  if (!profile) {
    const t = await getTranslations("tutors.availability");
    return (
      <div className={styles.card} id="weekly-availability">
        <div className={styles.cardHeader}>
          <div>
            <h2 className={styles.cardTitle}>{t("title")}</h2>
            <p className={styles.cardDescription}>{t("description")}</p>
          </div>
        </div>
        <div className={styles.emptyState}>
          <h3>{t("lockedTitle")}</h3>
          <p>{t("lockedBody")}</p>
          <a className={styles.buttonSecondary} href="#teaching-profile">
            {t("lockedCta")}
          </a>
        </div>
      </div>
    );
  }
  return <WeeklyAvailabilityEditor timeZone={profile.timeZone} availability={availability} />;
}
