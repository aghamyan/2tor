import { getTranslations } from "next-intl/server";
import Link from "next/link";

import type { TutorProfileRecord } from "../../../../packages/domain/tutors/models";
import styles from "./tutors.module.css";
import { ZoomSettingsForm } from "./zoom-settings-form";

/** Same reasoning as `capabilities-editor-or-locked.tsx`: `updateTutorZoomDefaults()` in
 * `packages/domain/tutors/services.ts` requires an existing profile row (`requireOwnProfile()`),
 * so there's nothing to save until the teaching profile exists. */
export async function ZoomSettingsOrLocked({ profile }: { profile: TutorProfileRecord | null }) {
  if (!profile) {
    const t = await getTranslations("tutors.zoomSettings");
    return (
      <div className={styles.card} id="zoom-settings">
        <div className={styles.cardHeader}>
          <div>
            <h2 className={styles.cardTitle}>{t("title")}</h2>
            <p className={styles.cardDescription}>{t("description")}</p>
          </div>
        </div>
        <div className={styles.emptyState}>
          <h3>{t("lockedTitle")}</h3>
          <p>{t("lockedBody")}</p>
          <Link className={styles.buttonSecondary} href="/tutors#teaching-profile">
            {t("lockedCta")}
          </Link>
        </div>
      </div>
    );
  }
  return (
    <ZoomSettingsForm
      defaultZoomJoinUrl={profile.defaultZoomJoinUrl}
      defaultZoomPasscode={profile.defaultZoomPasscode}
    />
  );
}
