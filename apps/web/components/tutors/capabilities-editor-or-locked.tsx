import { getTranslations } from "next-intl/server";

import type {
  TutorGradeRangeRecord,
  TutorLanguageRecord,
  TutorProfileRecord,
  TutorSubjectRecord,
} from "../../../../packages/domain/tutors/models";
import { CapabilitiesEditor } from "./capabilities-editor";
import styles from "./tutors.module.css";

/** Subjects/grade ranges/languages are keyed off the tutor profile row (`requireOwnProfile()` in
 * `packages/domain/tutors/services.ts`), so there is nothing to save until basic information
 * exists. Shown as a locked card rather than hiding the section outright, so the workspace's
 * overall shape doesn't shift once the profile is created. */
export async function CapabilitiesEditorOrLocked({
  profile,
  subjects,
  gradeRanges,
  languages,
}: {
  profile: TutorProfileRecord | null;
  subjects: TutorSubjectRecord[];
  gradeRanges: TutorGradeRangeRecord[];
  languages: TutorLanguageRecord[];
}) {
  if (!profile) {
    const t = await getTranslations("tutors.capabilities");
    return (
      <div className={styles.card} id="subjects-and-levels">
        <div className={styles.cardHeader}>
          <div>
            <h2 className={styles.cardTitle}>{t("subjectsTitle")}</h2>
            <p className={styles.cardDescription}>{t("subjectsDescription")}</p>
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
  return <CapabilitiesEditor subjects={subjects} gradeRanges={gradeRanges} languages={languages} />;
}
