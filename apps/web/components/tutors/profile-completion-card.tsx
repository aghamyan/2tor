import { getTranslations } from "next-intl/server";
import type { CSSProperties } from "react";

import type {
  TutorAvailabilityRule,
  TutorDocumentRecord,
  TutorEvaluationRecord,
  TutorGradeRangeRecord,
  TutorLanguageRecord,
  TutorProfileRecord,
  TutorSubjectRecord,
  TutorSuspensionRecord,
  TutorVerificationRecord,
} from "../../../../packages/domain/tutors/models";
import { hasRequiredDocuments } from "./document-helpers";
import { initials } from "./initials";
import { StatusBadge } from "./status-badge";
import styles from "./tutors.module.css";
import { overallVerificationStatus } from "./verification-overall";

interface ChecklistStep {
  id: string;
  labelKey: string;
  complete: boolean;
  href: string;
}

export async function ProfileCompletionCard({
  profile,
  subjects,
  gradeRanges,
  languages,
  availability,
  documents,
  verifications,
  evaluations,
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
  suspensions: TutorSuspensionRecord[];
}) {
  const t = await getTranslations("tutors.completion");

  const steps: ChecklistStep[] = [
    { id: "basic", labelKey: "basicInfo", complete: profile !== null, href: "#teaching-profile" },
    {
      id: "subjects",
      labelKey: "subjects",
      complete: subjects.length > 0,
      href: "#subjects-and-levels",
    },
    {
      id: "languages",
      labelKey: "languages",
      complete: languages.length > 0,
      // The languages editor only renders once at least one subject exists (it shares the
      // combined capabilities form) — pointing here instead of `#teaching-languages` means the
      // link always resolves to something on the page, even when languages itself isn't rendered.
      href: "#subjects-and-levels",
    },
    {
      id: "grades",
      labelKey: "gradeLevels",
      complete: gradeRanges.length > 0,
      href: "#subjects-and-levels",
    },
    {
      id: "availability",
      labelKey: "availability",
      complete: availability.length > 0,
      href: "#weekly-availability",
    },
    {
      id: "documents",
      labelKey: "documents",
      complete: hasRequiredDocuments(documents),
      href: "#verification-documents",
    },
    {
      id: "evaluation",
      labelKey: "evaluation",
      complete: evaluations.length > 0,
      href: "#training",
    },
  ];

  const completeCount = steps.filter((step) => step.complete).length;
  const percent = Math.round((completeCount / steps.length) * 100);
  const nextStep = steps.find((step) => !step.complete);
  const verificationOverall = overallVerificationStatus(verifications, suspensions);
  const verificationTone =
    verificationOverall === "verified"
      ? ("mint" as const)
      : verificationOverall === "inProgress"
        ? ("amber" as const)
        : verificationOverall === "actionRequired" || verificationOverall === "restricted"
          ? ("coral" as const)
          : ("neutral" as const);

  return (
    <div className={styles.card} aria-labelledby="completion-heading">
      <div className={styles.completionTop}>
        <span className={styles.avatar} aria-hidden="true">
          {profile ? initials(profile.publicDisplayName) : "?"}
        </span>
        <div className={styles.identity}>
          <strong>{profile?.publicDisplayName ?? t("noProfileYet")}</strong>
          <span>{subjects.find((subject) => subject.isPrimary)?.name ?? subjects[0]?.name ?? t("noSubject")}</span>
          <span>{profile?.timeZone ?? "—"}</span>
        </div>
        <span className={styles.ring} style={{ "--pct": percent } as CSSProperties}>
          <span>{percent}%</span>
        </span>
      </div>

      <p className={styles.completionNote} id="completion-heading">
        {t("percentComplete", { percent })}
      </p>

      <ul className={styles.checklist}>
        {steps.map((step) => (
          <li className={styles.checklistItem} key={step.id}>
            <a href={step.href} className={styles.checklistLabel}>
              <span
                className={styles.checklistDot}
                data-tone={step.complete ? "mint" : "amber"}
                aria-hidden="true"
              />
              {t(`steps.${step.labelKey}`)}
            </a>
            <span>{step.complete ? t("stepComplete") : t("stepMissing")}</span>
          </li>
        ))}
        <li className={styles.checklistItem}>
          <span className={styles.checklistLabel}>
            <span
              className={styles.checklistDot}
              data-tone={verificationOverall === "verified" ? "mint" : "amber"}
              aria-hidden="true"
            />
            {t("steps.verification")}
          </span>
          <StatusBadge tone={verificationTone} label={t(`verificationStatus.${verificationOverall}`)} />
        </li>
      </ul>

      {nextStep ? (
        <>
          <p className={styles.completionNote}>{t("gatingNote")}</p>
          <a className={styles.buttonPrimary} href={nextStep.href}>
            {t(`cta.${nextStep.labelKey}`)}
          </a>
        </>
      ) : (
        <p className={styles.completionNote}>{t("allSet")}</p>
      )}
    </div>
  );
}
