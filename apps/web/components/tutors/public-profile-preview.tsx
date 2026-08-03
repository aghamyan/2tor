import { getTranslations } from "next-intl/server";

import type {
  TutorGradeRangeRecord,
  TutorLanguageRecord,
  TutorProfileRecord,
  TutorSubjectRecord,
} from "../../../../packages/domain/tutors/models";
import { initials } from "./initials";
import { StatusBadge } from "./status-badge";
import styles from "./tutors.module.css";

function gradeSummary(ranges: TutorGradeRangeRecord[]): string[] {
  return ranges.map((range) =>
    range.includesAdult ? "Adults" : `${range.minGrade ?? "?"}–${range.maxGrade ?? "?"}`,
  );
}

/**
 * `getPublicTutorProfile()` only returns data once `status === "active" && publicProfileApprovedAt`
 * is set — same gate applied here, since there is no separate public-facing tutor profile route in
 * this app to link out to. This card *is* the preview.
 */
export async function PublicProfilePreview({
  profile,
  subjects,
  gradeRanges,
  languages,
}: {
  profile: TutorProfileRecord;
  subjects: TutorSubjectRecord[];
  gradeRanges: TutorGradeRangeRecord[];
  languages: TutorLanguageRecord[];
}) {
  const t = await getTranslations("tutors.preview");
  const publishable = profile.status === "active" && profile.publicProfileApprovedAt !== null;
  const primarySubject = subjects.find((subject) => subject.isPrimary) ?? subjects[0];
  const grades = gradeSummary(gradeRanges);

  return (
    <div className={styles.card} aria-labelledby="preview-heading">
      <div className={styles.cardHeader}>
        <h2 className={styles.cardTitle} id="preview-heading">
          {t("title")}
        </h2>
        {publishable ? <StatusBadge tone="mint" label={t("verified")} /> : null}
      </div>

      <div className={styles.previewHeader}>
        <span className={styles.avatar} aria-hidden="true">
          {initials(profile.publicDisplayName)}
        </span>
        <div>
          <strong>{profile.publicDisplayName}</strong>
          <p className={styles.previewSubjects}>{profile.headline || t("noHeadline")}</p>
        </div>
      </div>

      <p className={styles.previewSubjects}>
        {[primarySubject?.name, grades.join(", "), languages.map((language) => language.languageCode.toUpperCase()).join(", ")]
          .filter(Boolean)
          .join(" · ") || t("noDetails")}
      </p>

      {profile.bio ? <p className={styles.previewBio}>{profile.bio}</p> : null}

      {!publishable ? (
        <div className={styles.previewLocked}>
          <p>{t("notPublishable")}</p>
        </div>
      ) : null}
    </div>
  );
}
