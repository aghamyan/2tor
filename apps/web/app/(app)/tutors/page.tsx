import { TutorWorkspace } from "../../../components/tutors/tutor-workspace";
import { currentTutorContext } from "./context";

export default async function TutorsPage() {
  const context = await currentTutorContext();
  const profile = await context.database.findTutorProfileByUserId(context.actor.userId);
  const [
    subjects,
    gradeRanges,
    languages,
    availability,
    documents,
    verifications,
    evaluations,
    training,
    suspensions,
  ] = profile
    ? await Promise.all([
        context.database.listSubjects(profile.id),
        context.database.listGradeRanges(profile.id),
        context.database.listLanguages(profile.id),
        context.database.listAvailability(profile.id, profile.timeZone),
        context.database.listDocuments(profile.id),
        context.database.listVerifications(profile.id),
        context.database.listEvaluations(profile.id),
        context.database.listTraining(profile.id),
        context.database.listSuspensions(profile.id),
      ])
    : [[], [], [], [], [], [], [], [], []];
  return (
    <TutorWorkspace
      profile={profile}
      subjects={subjects}
      gradeRanges={gradeRanges}
      languages={languages}
      availability={availability}
      documents={documents}
      verifications={verifications}
      evaluations={evaluations}
      training={training}
      suspensions={suspensions}
    />
  );
}
