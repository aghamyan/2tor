"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import type {
  TutorGradeRangeRecord,
  TutorLanguageProficiency,
  TutorLanguageRecord,
  TutorSubjectRecord,
} from "../../../../packages/domain/tutors/models";
import { GRADE_GROUPS, gradeLabel, gradesFromRanges, rangesFromGrades } from "./grade-levels";
import styles from "./tutors.module.css";

type SaveState = "idle" | "saving" | "saved" | "error";

const PROFICIENCIES: TutorLanguageProficiency[] = ["native", "fluent", "conversational"];

/** Real ISO 639-1 codes only — there is no language catalog API to draw from, so this is a fixed
 * reference list rather than app data. Not the "fake data" the product spec warns against: it never
 * claims to be exhaustive or platform-specific, just a starting set to pick a real code from. */
const LANGUAGE_OPTIONS: Array<{ code: string; name: string }> = [
  { code: "en", name: "English" },
  { code: "hy", name: "Armenian" },
  { code: "ru", name: "Russian" },
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "it", name: "Italian" },
  { code: "pt", name: "Portuguese" },
  { code: "zh", name: "Chinese" },
  { code: "ar", name: "Arabic" },
  { code: "tr", name: "Turkish" },
  { code: "fa", name: "Persian" },
  { code: "hi", name: "Hindi" },
  { code: "ko", name: "Korean" },
  { code: "ja", name: "Japanese" },
];
const languageName = (code: string) =>
  LANGUAGE_OPTIONS.find((option) => option.code === code)?.name ?? code.toUpperCase();

export function CapabilitiesEditor({
  subjects,
  gradeRanges,
  languages,
}: {
  subjects: TutorSubjectRecord[];
  gradeRanges: TutorGradeRangeRecord[];
  languages: TutorLanguageRecord[];
}) {
  const t = useTranslations("tutors.capabilities");
  const router = useRouter();
  const [state, setState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);

  const [subjectList, setSubjectList] = useState(subjects);
  const initialGrades = useMemo(() => gradesFromRanges(gradeRanges), [gradeRanges]);
  const [grades, setGrades] = useState(initialGrades.grades);
  const [includesAdult, setIncludesAdult] = useState(initialGrades.includesAdult);
  const preservedRanges = initialGrades.preserved;
  const [languageList, setLanguageList] = useState(languages);
  const [newLanguageCode, setNewLanguageCode] = useState("");

  const selectedLevelCount = grades.size + (includesAdult ? 1 : 0);
  const availableLanguageOptions = LANGUAGE_OPTIONS.filter(
    (option) => !languageList.some((language) => language.languageCode === option.code),
  );

  function toggleGrade(grade: number) {
    setGrades((current) => {
      const next = new Set(current);
      if (next.has(grade)) next.delete(grade);
      else next.add(grade);
      return next;
    });
  }

  function setGroupSelection(groupGrades: readonly number[], selected: boolean) {
    setGrades((current) => {
      const next = new Set(current);
      for (const grade of groupGrades) {
        if (selected) next.add(grade);
        else next.delete(grade);
      }
      return next;
    });
  }

  function removeSubject(subjectId: string) {
    setSubjectList((current) => {
      const next = current.filter((subject) => subject.subjectId !== subjectId);
      const first = next[0];
      if (first && !next.some((subject) => subject.isPrimary)) {
        return next.map((subject) => (subject === first ? { ...subject, isPrimary: true } : subject));
      }
      return next;
    });
  }

  function makePrimary(subjectId: string) {
    setSubjectList((current) =>
      current.map((subject) => ({ ...subject, isPrimary: subject.subjectId === subjectId })),
    );
  }

  function addLanguage() {
    if (!newLanguageCode) return;
    setLanguageList((current) => [
      ...current,
      { languageCode: newLanguageCode, proficiency: "conversational" },
    ]);
    setNewLanguageCode("");
  }

  function removeLanguage(code: string) {
    setLanguageList((current) => current.filter((language) => language.languageCode !== code));
  }

  function setProficiency(code: string, proficiency: TutorLanguageProficiency) {
    setLanguageList((current) =>
      current.map((language) =>
        language.languageCode === code ? { ...language, proficiency } : language,
      ),
    );
  }

  const canSave = subjectList.length > 0 && languageList.length > 0;

  async function save() {
    if (!canSave) return;
    setState("saving");
    setError(null);
    const response = await fetch("/api/tutors/me/capabilities", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        subjects: subjectList.map((subject) => ({
          subjectId: subject.subjectId,
          isPrimary: subject.isPrimary,
        })),
        gradeRanges: rangesFromGrades(grades, includesAdult, preservedRanges),
        languages: languageList.map((language) => ({
          languageCode: language.languageCode,
          proficiency: language.proficiency,
        })),
      }),
    });
    if (!response.ok) {
      setState("error");
      const body = await response.json().catch(() => null);
      setError(body?.error?.message ?? t("saveError"));
      return;
    }
    setState("saved");
    router.refresh();
  }

  if (subjectList.length === 0) {
    return (
      <div className={styles.card} id="subjects-and-levels">
        <div className={styles.cardHeader}>
          <div>
            <h2 className={styles.cardTitle}>{t("subjectsTitle")}</h2>
            <p className={styles.cardDescription}>{t("subjectsDescription")}</p>
          </div>
        </div>
        <div className={styles.emptyState}>
          <h3>{t("noSubjectsTitle")}</h3>
          <p>{t("noSubjectsBody")}</p>
          <Link className={styles.buttonSecondary} href="/support">
            {t("noSubjectsCta")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.card} id="subjects-and-levels" aria-labelledby="subjects-heading">
      <div className={styles.cardHeader}>
        <div>
          <h2 className={styles.cardTitle} id="subjects-heading">
            {t("subjectsTitle")}
          </h2>
          <p className={styles.cardDescription}>{t("subjectsDescription")}</p>
        </div>
      </div>

      <div className={styles.chipRow}>
        {subjectList.map((subject) => (
          <div className={styles.chip} data-primary={subject.isPrimary} key={subject.subjectId}>
            <div className={styles.chipTop}>
              <span className={styles.chipName}>{subject.name}</span>
              {subject.isPrimary ? (
                <span className={`${styles.badge} ${styles.badgeIndigo}`}>{t("primary")}</span>
              ) : null}
            </div>
            <div className={styles.chipActions}>
              {!subject.isPrimary ? (
                <button className={styles.buttonGhost} type="button" onClick={() => makePrimary(subject.subjectId)}>
                  {t("makePrimary")}
                </button>
              ) : null}
              {subjectList.length > 1 ? (
                <button
                  className={`${styles.buttonGhost} ${styles.buttonDanger}`}
                  type="button"
                  onClick={() => removeSubject(subject.subjectId)}
                >
                  {t("remove")}
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
      <p className={styles.completionNote}>{t("addSubjectHint")}</p>

      <h3 className={styles.subheading}>{t("levelsTitle")}</h3>
      <p className={styles.cardDescription}>{t("levelsDescription")}</p>

      <div className={styles.groupList}>
        {GRADE_GROUPS.map((group) => {
          const groupSelectedCount = group.grades.filter((grade) => grades.has(grade)).length;
          const allSelected = groupSelectedCount === group.grades.length;
          return (
            <details className={styles.gradeGroup} key={group.id} open>
              <summary>
                {t(`groups.${group.id}`)}
                <span className={styles.gradeGroupMeta}>
                  {t("groupSelectedCount", { count: groupSelectedCount, total: group.grades.length })}
                  <button
                    className={styles.buttonGhost}
                    type="button"
                    onClick={(event) => {
                      event.preventDefault();
                      setGroupSelection(group.grades, !allSelected);
                    }}
                  >
                    {allSelected ? t("clear") : t("selectAll")}
                  </button>
                </span>
              </summary>
              <div className={styles.gradeOptions}>
                {group.grades.map((grade) => (
                  <label className={styles.gradeOption} key={grade}>
                    <input
                      type="checkbox"
                      checked={grades.has(grade)}
                      onChange={() => toggleGrade(grade)}
                    />
                    {t("grade", { label: gradeLabel(grade) })}
                  </label>
                ))}
              </div>
            </details>
          );
        })}
      </div>

      <label className={styles.selectRow}>
        <input
          type="checkbox"
          checked={includesAdult}
          onChange={(event) => setIncludesAdult(event.currentTarget.checked)}
        />
        {t("adultLearners")}
      </label>

      <p className={styles.completionNote}>{t("levelsSelected", { count: selectedLevelCount })}</p>
      {preservedRanges.length > 0 ? (
        <p className={styles.completionNote}>{t("preservedRanges", { count: preservedRanges.length })}</p>
      ) : null}

      <hr className={styles.sectionDivider} />

      <div id="teaching-languages">
        <h2 className={styles.subheading}>{t("languagesTitle")}</h2>
        <p className={styles.cardDescription}>{t("languagesDescription")}</p>

        {languageList.length === 0 ? (
          <div className={styles.emptyState}>
            <h3>{t("noLanguagesTitle")}</h3>
            <p>{t("noLanguagesBody")}</p>
          </div>
        ) : (
          <div className={styles.rowList}>
            {languageList.map((language) => (
              <div className={styles.docRow} key={language.languageCode}>
                <div className={styles.docMeta}>
                  <strong>{languageName(language.languageCode)}</strong>
                </div>
                <div className={styles.docActions}>
                  <label className={`${styles.field} ${styles.inlineField}`}>
                    <span className={styles.srOnly}>{t("proficiency")}</span>
                    <select
                      value={language.proficiency}
                      onChange={(event) =>
                        setProficiency(
                          language.languageCode,
                          event.currentTarget.value as TutorLanguageProficiency,
                        )
                      }
                    >
                      {PROFICIENCIES.map((proficiency) => (
                        <option key={proficiency} value={proficiency}>
                          {t(`proficiencies.${proficiency}`)}
                        </option>
                      ))}
                    </select>
                  </label>
                  {languageList.length > 1 ? (
                    <button
                      className={`${styles.buttonGhost} ${styles.buttonDanger}`}
                      type="button"
                      onClick={() => removeLanguage(language.languageCode)}
                    >
                      {t("remove")}
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}

        {availableLanguageOptions.length > 0 ? (
          <div className={`${styles.rangeRow} ${styles.addLanguageRow}`}>
            <select
              aria-label={t("addLanguage")}
              value={newLanguageCode}
              onChange={(event) => setNewLanguageCode(event.currentTarget.value)}
            >
              <option value="">{t("chooseLanguage")}</option>
              {availableLanguageOptions.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.name}
                </option>
              ))}
            </select>
            <button
              className={styles.buttonSecondary}
              type="button"
              disabled={!newLanguageCode}
              onClick={addLanguage}
            >
              {t("addLanguage")}
            </button>
          </div>
        ) : null}
      </div>

      <div className={styles.saveBar}>
        <span
          className={styles.saveStatus}
          data-tone={state === "saved" ? "success" : state === "error" ? "error" : undefined}
          aria-live="polite"
        >
          {state === "saving" && t("saving")}
          {state === "saved" && t("saved")}
          {state === "error" && (error ?? t("saveError"))}
          {state === "idle" && !canSave && t("needsBoth")}
        </span>
        <button className={styles.buttonPrimary} disabled={state === "saving" || !canSave} type="button" onClick={save}>
          {t("save")}
        </button>
      </div>
    </div>
  );
}
