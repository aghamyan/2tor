import Link from "next/link";
import { getTranslations } from "next-intl/server";

import type {
  TutorAvailabilityRule,
  TutorDocumentRecord,
  TutorEvaluationRecord,
  TutorGradeRangeRecord,
  TutorLanguageRecord,
  TutorProfileRecord,
  TutorSubjectRecord,
  TutorSuspensionRecord,
  TutorTrainingRecord,
  TutorVerificationRecord,
} from "../../../../packages/domain/tutors/models";
import { AvailabilityEditorOrLocked } from "./availability-editor-or-locked";
import { CapabilitiesEditorOrLocked } from "./capabilities-editor-or-locked";
import { ProfileCompletionCard } from "./profile-completion-card";
import { PublicProfilePreview } from "./public-profile-preview";
import { TeachingProfileForm } from "./teaching-profile-form";
import { TrainingChecklist } from "./training-checklist";
import styles from "./tutors.module.css";
import { VerificationDocuments } from "./verification-documents";
import { VerificationStatus } from "./verification-status";

export async function TutorWorkspace({
  profile,
  subjects,
  gradeRanges,
  languages,
  availability,
  documents,
  verifications,
  evaluations,
  training,
  suspensions,
}: {
  profile: TutorProfileRecord | null;
  subjects: TutorSubjectRecord[];
  gradeRanges: TutorGradeRangeRecord[];
  languages: TutorLanguageRecord[];
  availability: TutorAvailabilityRule[];
  documents: TutorDocumentRecord[];
  verifications: TutorVerificationRecord[];
  evaluations: TutorEvaluationRecord[];
  training: TutorTrainingRecord[];
  suspensions: TutorSuspensionRecord[];
}) {
  const t = await getTranslations("tutors.workspace");

  return (
    <div className={styles.workspace}>
      <nav className={styles.breadcrumb} aria-label={t("breadcrumbLabel")}>
        <Link href="/dashboard">{t("breadcrumbOverview")}</Link> / {t("breadcrumbCurrent")}
      </nav>

      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>{t("eyebrow")}</p>
          <h1 className={styles.title}>{t("title")}</h1>
          <p className={styles.subtitle}>{t("subtitle")}</p>
        </div>
        <div className={styles.headerActions}>
          <Link className={styles.buttonSecondary} href="/tutors/students">
            {t("viewStudents")}
          </Link>
        </div>
      </header>

      <div className={styles.layout}>
        <div className={styles.main}>
          <TeachingProfileForm profile={profile} />
          <CapabilitiesEditorOrLocked profile={profile} subjects={subjects} gradeRanges={gradeRanges} languages={languages} />
          <AvailabilityEditorOrLocked profile={profile} availability={availability} />
          <VerificationDocuments documents={documents} disabled={!profile} />
          <VerificationStatus verifications={verifications} suspensions={suspensions} />
          <TrainingChecklist evaluations={evaluations} training={training} />
        </div>

        <div className={styles.rail}>
          <ProfileCompletionCard
            profile={profile}
            subjects={subjects}
            gradeRanges={gradeRanges}
            languages={languages}
            availability={availability}
            documents={documents}
            verifications={verifications}
            evaluations={evaluations}
            suspensions={suspensions}
          />
          {profile ? (
            <PublicProfilePreview
              profile={profile}
              subjects={subjects}
              gradeRanges={gradeRanges}
              languages={languages}
            />
          ) : null}
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>{t("helpTitle")}</h2>
            <p className={styles.cardDescription}>{t("helpBody")}</p>
            <Link className={styles.buttonGhost} href="/support">
              {t("helpCta")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
