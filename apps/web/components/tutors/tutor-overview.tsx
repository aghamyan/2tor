import type {
  TutorAvailabilityRule,
  TutorDocumentRecord,
  TutorGradeRangeRecord,
  TutorLanguageRecord,
  TutorProfileRecord,
  TutorEvaluationRecord,
  TutorSuspensionRecord,
  TutorSubjectRecord,
  TutorTrainingRecord,
  TutorVerificationRecord,
} from "../../../../packages/domain/tutors/models";
import { minutesToLocalTime } from "../../../../packages/domain/tutors/availability";

const weekday = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function TutorOverview({
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
  if (!profile)
    return (
      <section>
        <p>Tutor workspace</p>
        <h1>Set up your tutor profile</h1>
        <p>
          Use the profile API to add your public details, teaching subjects, languages, grade
          ranges, and availability.
        </p>
      </section>
    );
  return (
    <section className="space-y-6">
      <header>
        <p className="text-sm opacity-70">Tutor workspace</p>
        <h1 className="text-2xl font-semibold">{profile.publicDisplayName}</h1>
        <p>{profile.headline}</p>
        <p className="text-sm opacity-70">Availability time zone: {profile.timeZone}</p>
      </header>
      <section>
        <h2 className="font-medium">Teaching profile</h2>
        <p>{subjects.map((subject) => subject.name).join(", ") || "No subjects yet"}</p>
        <p>
          {languages
            .map((language) => `${language.languageCode} (${language.proficiency})`)
            .join(", ") || "No languages yet"}
        </p>
        <p>
          {gradeRanges
            .map((range) =>
              range.includesAdult ? "Adults" : `${range.minGrade ?? "?"}–${range.maxGrade ?? "?"}`,
            )
            .join(", ") || "No grade ranges yet"}
        </p>
      </section>
      <section>
        <h2 className="font-medium">Weekly availability</h2>
        <ul>
          {availability.map((rule) => (
            <li key={rule.id}>
              {weekday[rule.dayOfWeek]} · {minutesToLocalTime(rule.startMinute)}–
              {minutesToLocalTime(rule.endMinute)} ({rule.timeZone})
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="font-medium">Verification documents</h2>
        <ul>
          {documents.map((document) => (
            <li key={document.id}>
              {document.type}: {document.status}
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="font-medium">Verification records</h2>
        <ul>
          {verifications.map((verification) => (
            <li key={verification.id}>
              {verification.type}: {verification.status}
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="font-medium">Evaluations and training</h2>
        <ul>
          {evaluations.map((evaluation) => (
            <li key={evaluation.id}>
              {evaluation.evaluationDate}: {evaluation.category ?? "Evaluation"}{" "}
              {evaluation.score ?? ""}
            </li>
          ))}
          {training.map((record) => (
            <li key={record.id}>
              {record.trainingType}: {record.status}
            </li>
          ))}
        </ul>
      </section>
      {suspensions.length > 0 ? (
        <section>
          <h2 className="font-medium">Account restrictions</h2>
          <ul>
            {suspensions.map((suspension) => (
              <li key={suspension.id}>{suspension.reason}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </section>
  );
}
