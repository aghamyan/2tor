import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { ZoomSettingsOrLocked } from "../../../../components/tutors/zoom-settings-or-locked";
import styles from "../../../../components/tutors/tutors.module.css";
import { currentTutorContext } from "../../tutors/context";

export const dynamic = "force-dynamic";

/**
 * Tutor-only "system settings": a default Zoom join URL/passcode saved once here is auto-assigned
 * to every new class (`packages/domain/scheduling/services.ts`'s auto-assign-on-create path) and
 * backfilled onto whatever's already on the calendar (`applyTutorZoomDefaultsToUpcomingLessons`,
 * triggered from `/api/tutors/me/zoom`'s PUT handler). A non-tutor sees the locked state, same as
 * `/tutors` itself — see `ZoomSettingsOrLocked`.
 */
export default async function ZoomSettingsPage() {
  const t = await getTranslations("tutors.zoomSettings");
  const context = await currentTutorContext();
  const profile = await context.database.findTutorProfileByUserId(context.actor.userId);

  return (
    <div className={styles.settingsShell}>
      <nav className={styles.breadcrumb} aria-label={t("breadcrumbLabel")}>
        <Link href="/tutors">{t("breadcrumbOverview")}</Link> / {t("breadcrumbCurrent")}
      </nav>
      <div>
        <p className={styles.eyebrow}>{t("eyebrow")}</p>
        <h1 className={styles.title}>{t("pageTitle")}</h1>
        <p className={styles.subtitle}>{t("pageSubtitle")}</p>
      </div>
      <ZoomSettingsOrLocked profile={profile} />
    </div>
  );
}
